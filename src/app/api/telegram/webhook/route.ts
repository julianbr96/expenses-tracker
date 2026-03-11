import { prisma } from "@/lib/db";
import { generateProjection } from "@/lib/finance";
import { loadModelForProjection } from "@/lib/load-model";
import { verifyPassword } from "@/lib/auth";
import { ensureDefaultExpenseCategories } from "@/lib/expense-categories-db";
import { NextResponse } from "next/server";

type ConversationStep =
  | "IDLE"
  | "AWAITING_CARD"
  | "AWAITING_CATEGORY"
  | "AWAITING_AMOUNT"
  | "AWAITING_CURRENCY"
  | "AWAITING_DATE"
  | "AWAITING_DESCRIPTION";
type AppCurrency = "USD" | "ARS";

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: {
      chat?: { id?: number };
    };
  };
}

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const CATEGORY_PAGE_SIZE = 6;
const ALLOWED_CHAT_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
);

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseCommand(rawText: string): { command: string; arg: string } {
  const [rawCommand, ...rest] = rawText.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];
  return { command, arg: rest.join(" ").trim() };
}

function parseLoginArgs(raw: string): { username: string; password: string } | null {
  const [usernameRaw, ...passwordParts] = raw.trim().split(/\s+/);
  const password = passwordParts.join(" ").trim();
  if (!usernameRaw || !password) return null;
  return { username: usernameRaw.trim().toLowerCase(), password };
}

function formatMoney(amount: number, currency: AppCurrency): string {
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency
  });
  return formatter.format(amount);
}

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(",", ".").replace(/[^\d.-]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function parseCurrency(raw: string): AppCurrency | null {
  const upper = raw.trim().toUpperCase();
  if (upper === "USD") return "USD";
  if (upper === "ARS") return "ARS";
  return null;
}

function parseDateInput(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === "-" || value === "skip" || value === "hoy" || value === "today") {
    return "NOW";
  }
  if (value === "ayer" || value === "yesterday") {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return toDateOnly(date);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function toLocalMidnight(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function cardPrompt(cards: Array<{ id: string; name: string }>): string {
  if (cards.length === 0) return "No active cards available. Create one in Settings first.";
  return "Add expense: choose card.";
}

function categoryPrompt(
  categories: Array<{ id: string; name: string; emoji: string }>,
  page: number
): string {
  if (categories.length === 0) {
    return "No categories found. Send amount to continue without category.";
  }
  const totalPages = Math.max(1, Math.ceil(categories.length / CATEGORY_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  return `Choose category (most used first). Page ${safePage + 1}/${totalPages}.`;
}

function buildCardKeyboard(cards: Array<{ id: string; name: string }>): InlineKeyboardMarkup {
  const rows = cards.map((card) => [{ text: card.name, callback_data: `add:card:${card.id}` }]);
  rows.push([{ text: "Cancel", callback_data: "add:cancel" }]);
  return { inline_keyboard: rows };
}

function buildCategoryKeyboard(
  categories: Array<{ id: string; name: string; emoji: string }>,
  page: number
): InlineKeyboardMarkup {
  const totalPages = Math.max(1, Math.ceil(Math.max(categories.length, 1) / CATEGORY_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * CATEGORY_PAGE_SIZE;
  const pageItems = categories.slice(start, start + CATEGORY_PAGE_SIZE);
  const rows = pageItems.map((category) => [
    { text: `${category.emoji} ${category.name}`, callback_data: `add:category:${category.id}` }
  ]);

  const navRow: Array<{ text: string; callback_data: string }> = [];
  if (safePage > 0) navRow.push({ text: "◀ Prev", callback_data: `add:category:page:${safePage - 1}` });
  if (safePage < totalPages - 1) navRow.push({ text: "More ▶", callback_data: `add:category:page:${safePage + 1}` });
  if (navRow.length > 0) rows.push(navRow);

  rows.push([{ text: "Skip category", callback_data: "add:category:skip" }]);
  rows.push([{ text: "Cancel", callback_data: "add:cancel" }]);
  return { inline_keyboard: rows };
}

function buildCurrencyKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "USD", callback_data: "add:currency:USD" },
        { text: "ARS", callback_data: "add:currency:ARS" }
      ],
      [{ text: "Cancel", callback_data: "add:cancel" }]
    ]
  };
}

function buildDateKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Today", callback_data: "add:date:today" },
        { text: "Yesterday", callback_data: "add:date:yesterday" }
      ],
      [{ text: "Cancel", callback_data: "add:cancel" }]
    ]
  };
}

function buildDescriptionKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Skip description", callback_data: "add:desc:skip" }],
      [{ text: "Cancel", callback_data: "add:cancel" }]
    ]
  };
}

function findCardByInput(
  cards: Array<{ id: string; name: string }>,
  input: string
): { id: string; name: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const maybeIndex = Number(trimmed);
  if (Number.isInteger(maybeIndex) && maybeIndex >= 1 && maybeIndex <= cards.length) {
    return cards[maybeIndex - 1];
  }

  const exact = cards.find((card) => card.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const fuzzy = cards.find((card) => card.name.toLowerCase().includes(trimmed.toLowerCase()));
  return fuzzy ?? null;
}

function findCategoryByInput(
  categories: Array<{ id: string; name: string; emoji: string }>,
  input: string
): { id: string; name: string; emoji: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const maybeIndex = Number(trimmed);
  if (Number.isInteger(maybeIndex) && maybeIndex >= 1 && maybeIndex <= categories.length) {
    return categories[maybeIndex - 1];
  }

  const exact = categories.find((category) => category.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const fuzzy = categories.find((category) =>
    category.name.toLowerCase().includes(trimmed.toLowerCase())
  );
  return fuzzy ?? null;
}

async function callTelegram(method: string, payload: Record<string, unknown>) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function answerCallbackQuery(callbackId: string | undefined) {
  if (!callbackId) return;
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackId });
}

async function sendTelegramMessage(chatId: bigint, text: string, replyMarkup?: InlineKeyboardMarkup) {
  await callTelegram("sendMessage", {
    chat_id: chatId.toString(),
    text,
    reply_markup: replyMarkup
  });
}

function loginRequiredMessage(): string {
  return "This chat is not linked to a user. Use /login <username> <password> first.";
}

async function listActiveCardsForUser(userId: string): Promise<Array<{ id: string; name: string }>> {
  return prisma.card.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });
}

async function listCategoriesForUser(
  userId: string
): Promise<Array<{ id: string; name: string; emoji: string }>> {
  await ensureDefaultExpenseCategories(userId);

  const [categories, categoryUsageRows] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, emoji: true }
    }),
    prisma.expense.findMany({
      where: {
        card: { userId },
        categoryId: { not: null }
      },
      select: { categoryId: true }
    })
  ]);

  const usageByCategoryId = new Map<string, number>();
  for (const row of categoryUsageRows) {
    if (!row.categoryId) continue;
    usageByCategoryId.set(row.categoryId, (usageByCategoryId.get(row.categoryId) ?? 0) + 1);
  }

  return categories.sort((a, b) => {
    const usageDiff = (usageByCategoryId.get(b.id) ?? 0) - (usageByCategoryId.get(a.id) ?? 0);
    if (usageDiff !== 0) return usageDiff;
    return a.name.localeCompare(b.name);
  });
}

async function buildCardRemainingMessage(userId: string, cardId: string): Promise<string | null> {
  const model = await loadModelForProjection(userId);
  const projection = generateProjection(model);
  const row = projection.cardTracker.find((item) => item.cardId === cardId);
  if (!row) return null;

  return [
    `Card: ${row.cardName}`,
    `Current cycle: ${formatMoney(row.currentCycleArs, "ARS")} (${formatMoney(row.currentCycleUsd, "USD")})`,
    `Expected: ${formatMoney(row.expectedCycleArs, "ARS")} (${formatMoney(row.expectedCycleUsd, "USD")})`,
    `Remaining: ${formatMoney(row.remainingExpectedArs, "ARS")} (${formatMoney(row.remainingExpectedUsd, "USD")})`
  ].join("\n");
}

async function buildAllRemainingsMessage(userId: string): Promise<string> {
  const model = await loadModelForProjection(userId);
  const projection = generateProjection(model);
  const lines = projection.cardTracker.map(
    (row) =>
      `- ${row.cardName}: ${formatMoney(row.remainingExpectedArs, "ARS")} remaining (${formatMoney(row.remainingExpectedUsd, "USD")})`
  );

  if (lines.length === 0) return "No cards found.";
  return `Remaining by card\n${lines.join("\n")}`;
}

async function clearSessionFlow(chatId: bigint) {
  await prisma.telegramSession.upsert({
    where: { chatId },
    update: {
      step: "IDLE",
      pendingCardId: null,
      pendingCategoryId: null,
      pendingCategoryPage: 0,
      pendingAmount: null,
      pendingCurrency: null,
      pendingDate: null,
      pendingDescription: null
    },
    create: { chatId, step: "IDLE" }
  });
}

async function logoutSession(chatId: bigint) {
  await prisma.telegramSession.upsert({
    where: { chatId },
    update: {
      userId: null,
      step: "IDLE",
      pendingCardId: null,
      pendingCategoryId: null,
      pendingCategoryPage: 0,
      pendingAmount: null,
      pendingCurrency: null,
      pendingDate: null,
      pendingDescription: null
    },
    create: { chatId, step: "IDLE", userId: null }
  });
}

async function handleCreateExpense(chatId: bigint, userId: string, description: string | null) {
  const session = await prisma.telegramSession.findUnique({ where: { chatId } });
  if (
    !session ||
    session.userId !== userId ||
    !session.pendingCardId ||
    !session.pendingAmount ||
    !session.pendingCurrency ||
    !session.pendingDate
  ) {
    await clearSessionFlow(chatId);
    await sendTelegramMessage(chatId, `Session data is incomplete. Start again with /add.\n${loginRequiredMessage()}`);
    return;
  }

  const card = await prisma.card.findFirst({
    where: { id: session.pendingCardId, userId },
    select: { id: true }
  });
  if (!card) {
    await clearSessionFlow(chatId);
    await sendTelegramMessage(chatId, "Selected source does not belong to the logged in user. Start again with /add.");
    return;
  }

  if (session.pendingCategoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: session.pendingCategoryId, userId, isActive: true },
      select: { id: true }
    });
    if (!category) {
      await clearSessionFlow(chatId);
      await sendTelegramMessage(chatId, "Selected category is no longer available. Start again with /add.");
      return;
    }
  }

  try {
    const created = await prisma.expense.create({
      data: {
        cardId: session.pendingCardId,
        categoryId: session.pendingCategoryId ?? null,
        amount: session.pendingAmount,
        currency: session.pendingCurrency,
        date: session.pendingDate,
        description
      },
      include: { card: true, category: true }
    });

    await clearSessionFlow(chatId);
    const remainingMessage = await buildCardRemainingMessage(userId, created.cardId);
    await sendTelegramMessage(
      chatId,
      [
        "Expense added successfully.",
        `${created.card.name} - ${formatMoney(Number(created.amount), created.currency as AppCurrency)} - ${toDateOnly(created.date)}`,
        `Category: ${created.category ? `${created.category.emoji} ${created.category.name}` : "None"}`,
        remainingMessage ?? "Could not calculate card remaining."
      ].join("\n")
    );
  } catch {
    await clearSessionFlow(chatId);
    await sendTelegramMessage(chatId, "Failed to add expense. Try again with /add.");
  }
}

async function handleCallback(
  chatId: bigint,
  callbackId: string | undefined,
  callbackData: string,
  step: ConversationStep,
  cards: Array<{ id: string; name: string }>,
  categories: Array<{ id: string; name: string; emoji: string }>,
  userId: string
) {
  await answerCallbackQuery(callbackId);

  if (callbackData === "add:cancel") {
    await clearSessionFlow(chatId);
    await sendTelegramMessage(chatId, "Expense flow canceled.");
    return;
  }

  if (callbackData.startsWith("add:card:")) {
    if (step !== "AWAITING_CARD") {
      await sendTelegramMessage(chatId, "Use /add to start a new expense.");
      return;
    }

    const cardId = callbackData.slice("add:card:".length);
    const selected = cards.find((card) => card.id === cardId);
    if (!selected) {
      await sendTelegramMessage(chatId, "Card not found. Start again with /add.");
      return;
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_CATEGORY",
        pendingCardId: selected.id,
        pendingCategoryId: null,
        pendingCategoryPage: 0
      }
    });
    await sendTelegramMessage(
      chatId,
      `Card: ${selected.name}\n${categoryPrompt(categories, 0)}`,
      buildCategoryKeyboard(categories, 0)
    );
    return;
  }

  if (callbackData.startsWith("add:category:")) {
    if (step !== "AWAITING_CATEGORY") {
      await sendTelegramMessage(chatId, "Please choose card first.");
      return;
    }

    if (callbackData === "add:category:skip") {
      await prisma.telegramSession.update({
        where: { chatId },
        data: {
          step: "AWAITING_AMOUNT",
          pendingCategoryId: null,
          pendingCategoryPage: 0
        }
      });
      await sendTelegramMessage(chatId, "No category selected.\nNow send amount (example: 120.50).");
      return;
    }

    if (callbackData.startsWith("add:category:page:")) {
      const pageRaw = callbackData.slice("add:category:page:".length);
      const parsedPage = Number(pageRaw);
      const page = Number.isFinite(parsedPage) ? Math.max(0, Math.trunc(parsedPage)) : 0;
      await prisma.telegramSession.update({
        where: { chatId },
        data: { pendingCategoryPage: page }
      });
      await sendTelegramMessage(chatId, categoryPrompt(categories, page), buildCategoryKeyboard(categories, page));
      return;
    }

    const categoryId = callbackData.slice("add:category:".length);
    const selected = categories.find((category) => category.id === categoryId);
    if (!selected) {
      await sendTelegramMessage(chatId, "Category not found. Choose another one.", buildCategoryKeyboard(categories, 0));
      return;
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_AMOUNT",
        pendingCategoryId: selected.id,
        pendingCategoryPage: 0
      }
    });
    await sendTelegramMessage(chatId, `Category: ${selected.emoji} ${selected.name}\nNow send amount (example: 120.50).`);
    return;
  }

  if (callbackData.startsWith("add:currency:")) {
    if (step !== "AWAITING_CURRENCY") {
      await sendTelegramMessage(chatId, "Please send amount first.");
      return;
    }

    const currency = parseCurrency(callbackData.slice("add:currency:".length));
    if (!currency) {
      await sendTelegramMessage(chatId, "Invalid currency. Use /add to restart.");
      return;
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: { step: "AWAITING_DATE", pendingCurrency: currency }
    });
    await sendTelegramMessage(
      chatId,
      "Choose date with buttons or type custom YYYY-MM-DD.",
      buildDateKeyboard()
    );
    return;
  }

  if (callbackData.startsWith("add:date:")) {
    if (step !== "AWAITING_DATE") {
      await sendTelegramMessage(chatId, "Please choose currency first.");
      return;
    }

    const key = callbackData.slice("add:date:".length);
    let pendingDate: Date;
    if (key === "today") {
      pendingDate = new Date();
    } else if (key === "yesterday") {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      pendingDate = toLocalMidnight(toDateOnly(date));
    } else {
      await sendTelegramMessage(chatId, "Invalid date option. Use /add to restart.");
      return;
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_DESCRIPTION",
        pendingDate
      }
    });
    await sendTelegramMessage(chatId, "Add description or tap skip.", buildDescriptionKeyboard());
    return;
  }

  if (callbackData === "add:desc:skip") {
    if (step !== "AWAITING_DESCRIPTION") {
      await sendTelegramMessage(chatId, "Not waiting for description.");
      return;
    }
    await handleCreateExpense(chatId, userId, null);
    return;
  }

  await sendTelegramMessage(chatId, "Unknown action. Use /add to restart.");
}

export async function POST(request: Request) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is missing" }, { status: 500 });
  }

  if (WEBHOOK_SECRET) {
    const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  const body = (await request.json()) as TelegramUpdate;
  const text = body.message?.text?.trim();
  const callbackData = body.callback_query?.data;
  const callbackId = body.callback_query?.id;
  const chatIdRaw = body.message?.chat?.id ?? body.callback_query?.message?.chat?.id;

  if (typeof chatIdRaw !== "number") {
    return NextResponse.json({ ok: true });
  }

  const chatId = BigInt(chatIdRaw);
  if (ALLOWED_CHAT_IDS.size > 0 && !ALLOWED_CHAT_IDS.has(chatId.toString())) {
    await sendTelegramMessage(chatId, "This chat is not allowed for this bot.");
    return NextResponse.json({ ok: true });
  }

  const existingSession = await prisma.telegramSession.upsert({
    where: { chatId },
    create: { chatId, step: "IDLE", userId: null },
    update: {}
  });
  const step = existingSession.step as ConversationStep;
  const userId = existingSession.userId;

  if (callbackData) {
    if (!userId) {
      await answerCallbackQuery(callbackId);
      await clearSessionFlow(chatId);
      await sendTelegramMessage(chatId, loginRequiredMessage());
      return NextResponse.json({ ok: true });
    }

    const cards = await listActiveCardsForUser(userId);
    const categories = await listCategoriesForUser(userId);
    await handleCallback(chatId, callbackId, callbackData, step, cards, categories, userId);
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/")) {
    const { command, arg } = parseCommand(text);

    if (command === "/start" || command === "/help") {
      await sendTelegramMessage(
        chatId,
        [
          "Commands:",
          "/login <username> <password> - link this chat to a user",
          "/logout - unlink current user",
          "/add - guided expense creation with source/category and buttons",
          "/remaining - remaining expected spend for all cards",
          "/remaining <card> - remaining for one card (name or index)",
          "/cancel - cancel current flow"
        ].join("\n")
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/login") {
      const credentials = parseLoginArgs(arg);
      if (!credentials) {
        await sendTelegramMessage(chatId, "Usage: /login <username> <password>");
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findUnique({ where: { username: credentials.username } });
      if (!user) {
        await sendTelegramMessage(chatId, "User not found.");
        return NextResponse.json({ ok: true });
      }

      const masterPassword = process.env.APP_PASSWORD ?? "";
      const usingMaster = masterPassword.length > 0 && credentials.password === masterPassword;
      if (!usingMaster && !verifyPassword(user.passwordHash, credentials.password)) {
        await sendTelegramMessage(chatId, "Invalid credentials.");
        return NextResponse.json({ ok: true });
      }

      await prisma.telegramSession.update({
        where: { chatId },
        data: {
          userId: user.id,
          step: "IDLE",
          pendingCardId: null,
          pendingCategoryId: null,
          pendingCategoryPage: 0,
          pendingAmount: null,
          pendingCurrency: null,
          pendingDate: null,
          pendingDescription: null
        }
      });
      await sendTelegramMessage(chatId, `Logged in as ${user.username}. You can now use /add and /remaining.`);
      return NextResponse.json({ ok: true });
    }

    if (command === "/logout") {
      await logoutSession(chatId);
      await sendTelegramMessage(chatId, "Logged out. Use /login <username> <password> to link again.");
      return NextResponse.json({ ok: true });
    }

    if (command === "/cancel") {
      await clearSessionFlow(chatId);
      await sendTelegramMessage(chatId, "Expense flow canceled.");
      return NextResponse.json({ ok: true });
    }

    if (!userId) {
      await sendTelegramMessage(chatId, loginRequiredMessage());
      return NextResponse.json({ ok: true });
    }

    const cards = await listActiveCardsForUser(userId);
    const categories = await listCategoriesForUser(userId);

    if (command === "/add") {
      await prisma.telegramSession.update({
        where: { chatId },
        data: {
          step: "AWAITING_CARD",
          pendingCardId: null,
          pendingCategoryId: null,
          pendingCategoryPage: 0,
          pendingAmount: null,
          pendingCurrency: null,
          pendingDate: null,
          pendingDescription: null
        }
      });
      await sendTelegramMessage(chatId, cardPrompt(cards), buildCardKeyboard(cards));
      return NextResponse.json({ ok: true });
    }

    if (command === "/remaining") {
      if (arg) {
        const selected = findCardByInput(cards, arg);
        if (!selected) {
          await sendTelegramMessage(chatId, `Card not found: "${arg}"`);
          return NextResponse.json({ ok: true });
        }
        const one = await buildCardRemainingMessage(userId, selected.id);
        await sendTelegramMessage(chatId, one ?? `Could not calculate remaining for ${selected.name}.`);
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(chatId, await buildAllRemainingsMessage(userId));
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(chatId, "Unknown command. Use /help.");
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    await sendTelegramMessage(chatId, loginRequiredMessage());
    return NextResponse.json({ ok: true });
  }

  const cards = await listActiveCardsForUser(userId);
  const categories = await listCategoriesForUser(userId);

  if (step === "IDLE") {
    await sendTelegramMessage(chatId, "No active flow. Use /add to add an expense.");
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_CARD") {
    const selected = findCardByInput(cards, text);
    if (!selected) {
      await sendTelegramMessage(chatId, "Card not found. Pick one using buttons.", buildCardKeyboard(cards));
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_CATEGORY",
        pendingCardId: selected.id,
        pendingCategoryId: null,
        pendingCategoryPage: 0
      }
    });
    await sendTelegramMessage(
      chatId,
      `Card: ${selected.name}\n${categoryPrompt(categories, 0)}`,
      buildCategoryKeyboard(categories, 0)
    );
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_CATEGORY") {
    const lowered = text.trim().toLowerCase();
    if (lowered === "-" || lowered === "skip" || lowered === "none") {
      await prisma.telegramSession.update({
        where: { chatId },
        data: {
          step: "AWAITING_AMOUNT",
          pendingCategoryId: null,
          pendingCategoryPage: 0
        }
      });
      await sendTelegramMessage(chatId, "No category selected.\nNow send amount (example: 120.50).");
      return NextResponse.json({ ok: true });
    }

    const selected = findCategoryByInput(categories, text);
    if (!selected) {
      const currentPage = existingSession.pendingCategoryPage ?? 0;
      await sendTelegramMessage(
        chatId,
        `Category not found. ${categoryPrompt(categories, currentPage)}`,
        buildCategoryKeyboard(categories, currentPage)
      );
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_AMOUNT",
        pendingCategoryId: selected.id,
        pendingCategoryPage: 0
      }
    });
    await sendTelegramMessage(chatId, `Category: ${selected.emoji} ${selected.name}\nNow send amount (example: 120.50).`);
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_AMOUNT") {
    const amount = parseAmount(text);
    if (!amount) {
      await sendTelegramMessage(chatId, "Invalid amount. Send a positive number, for example: 120.50");
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_CURRENCY",
        pendingAmount: amount
      }
    });
    await sendTelegramMessage(chatId, "Choose currency.", buildCurrencyKeyboard());
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_CURRENCY") {
    const currency = parseCurrency(text);
    if (!currency) {
      await sendTelegramMessage(chatId, "Use currency buttons: USD or ARS.", buildCurrencyKeyboard());
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_DATE",
        pendingCurrency: currency
      }
    });
    await sendTelegramMessage(
      chatId,
      "Choose date with buttons or type custom YYYY-MM-DD.",
      buildDateKeyboard()
    );
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_DATE") {
    const dateOnly = parseDateInput(text);
    if (!dateOnly) {
      await sendTelegramMessage(chatId, "Invalid date. Use buttons or type YYYY-MM-DD.", buildDateKeyboard());
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramSession.update({
      where: { chatId },
      data: {
        step: "AWAITING_DESCRIPTION",
        pendingDate: dateOnly === "NOW" ? new Date() : toLocalMidnight(dateOnly)
      }
    });
    await sendTelegramMessage(chatId, "Add description or tap skip.", buildDescriptionKeyboard());
    return NextResponse.json({ ok: true });
  }

  if (step === "AWAITING_DESCRIPTION") {
    const description = text === "-" ? null : text;
    await handleCreateExpense(chatId, userId, description);
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage(chatId, "Unknown state. Use /cancel and /add again.");
  return NextResponse.json({ ok: true });
}
