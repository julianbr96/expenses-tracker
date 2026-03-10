"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SOURCE_TYPE_OPTIONS,
  SourceTypeGlyph,
  sourceTypeLabel,
  sourceTypeMeta,
  sourceTypeSelectLabel,
  type SourceType
} from "@/lib/sourceTypes";

type Currency = "USD" | "ARS";
type Tab = "dashboard" | "tracker" | "expenses" | "forecast" | "settings";
type ExpenseDisplayMode = "STORED" | Currency;
type ExpenseTimeFilter =
  | "TODAY"
  | "CURRENT_WEEK"
  | "CURRENT_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_7_DAYS"
  | "CUSTOM_MONTH"
  | "ALL_TIME";

const EXPENSE_TIME_FILTERS: Array<{ value: ExpenseTimeFilter; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "CURRENT_WEEK", label: "Current week" },
  { value: "LAST_7_DAYS", label: "Last 7 days" },
  { value: "CURRENT_MONTH", label: "Current month" },
  { value: "LAST_MONTH", label: "Last month" },
  { value: "LAST_3_MONTHS", label: "Last 3 months" },
  { value: "CUSTOM_MONTH", label: "Specific month" },
  { value: "ALL_TIME", label: "All time" }
];

function sourceTypeOptionLabel(value: SourceType | string | null | undefined, name: string): string {
  const SELECT_STYLE: "emoji" | "text" = "emoji";
  return sourceTypeSelectLabel(value, name, SELECT_STYLE);
}

function findCardById(cards: Card[], cardId: string): Card | undefined {
  return cards.find((card) => card.id === cardId);
}

const MOBILE_TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "dashboard", label: "Home", icon: "◉" },
  { id: "tracker", label: "Tracking", icon: "◈" },
  { id: "expenses", label: "Expenses", icon: "◎" },
  { id: "forecast", label: "Forecast", icon: "◌" },
  { id: "settings", label: "Settings", icon: "◍" }
];

interface Card {
  id: string;
  name: string;
  currency: Currency;
  sourceType: SourceType;
  isActive: boolean;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  description: string | null;
  cardId: string;
  card: Card;
}

interface Income {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface Expectation {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  cardId: string;
  card: Card;
}

interface ExchangeRate {
  date: string;
  arsPerUsd: number;
  source: string | null;
}

interface MonthlyAdjustment {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  note: string | null;
}

interface Advancement {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  note: string | null;
  isActive: boolean;
}

interface ProjectionRow {
  month: string;
  incomeUsd: number;
  fixedExpensesUsd: number;
  cardPaymentUsd: number;
  advancementImpactUsd: number;
  manualAdjustmentUsd: number;
  totalExpensesUsd: number;
  netUsd: number;
  cumulativeSavingsUsd: number;
}

interface ProjectionData {
  currentMonth: string;
  paymentMonth: string;
  currentRateArsPerUsd: number;
  startMonth: string;
  rows: ProjectionRow[];
  cardTracker: {
    cardId: string;
    cardName: string;
    currentCycleUsd: number;
    expectedCycleUsd: number;
    remainingExpectedUsd: number;
    currentCycleArs: number;
    expectedCycleArs: number;
    remainingExpectedArs: number;
    lastExpenseDate: string | null;
  }[];
  dashboard: {
    incomeUsd: number;
    expectedExpensesUsd: number;
    projectedSavingsUsd: number;
    nextCardPaymentUsd: number;
    nextCardPaymentArs: number;
  };
}

interface Bootstrap {
  currentUser: {
    id: string;
    username: string;
  } | null;
  projection: ProjectionData;
  cards: Card[];
  expenses: Expense[];
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  expectations: Expectation[];
  exchangeRates: ExchangeRate[];
  monthlyAdjustments: MonthlyAdjustment[];
  advancements: Advancement[];
}

const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const ARS_FORMAT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2
});

function formatCodeAmount(amount: number, currency: Currency): string {
  const locale = currency === "ARS" ? "es-AR" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  return `${currency} ${formatted}`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function toMonthLabel(month: string): string {
  return MONTH_FORMAT.format(new Date(`${month}-01T00:00:00.000Z`));
}

function toLocalDateTimeLabel(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcExpenseDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return toUtcDateKey(date);
}

function toLocalExpenseDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return toLocalDateKey(date);
}

function expenseDateTimeIso(date: string, useNow: boolean): string {
  if (useNow) return new Date().toISOString();
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!year || !month || !day) return new Date().toISOString();
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  return localMidnight.toISOString();
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function parseApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed: ${response.status}`;

  try {
    const payload = JSON.parse(text) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    if (payload.error && typeof payload.error === "object") return "Validation error";
  } catch {
    // Non-JSON payloads keep original text fallback below.
  }

  return text;
}

async function refreshSessionToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function api<T>(url: string, options?: RequestInit, allowRefresh = true): Promise<T> {
  const method = options?.method?.toUpperCase() ?? "GET";
  const hasBody = options?.body !== undefined;
  const headers = new Headers(options?.headers ?? {});
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers
  });

  if (response.status === 401 && allowRefresh && !url.startsWith("/api/auth/")) {
    const refreshed = await refreshSessionToken();
    if (refreshed) {
      return api<T>(url, options, false);
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseApiErrorMessage(response));
  }

  if (response.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const year = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

function triggerHaptic() {
  if (typeof navigator === "undefined") return;
  if ("vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expenseDateBounds(filter: ExpenseTimeFilter, customMonth: string): { from: string | null; to: string | null } {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = toUtcDateKey(todayUtc);

  if (filter === "ALL_TIME") return { from: null, to: null };
  if (filter === "TODAY") return { from: todayKey, to: todayKey };
  if (filter === "CURRENT_MONTH") {
    const monthStart = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
    return { from: toUtcDateKey(monthStart), to: todayKey };
  }
  if (filter === "LAST_MONTH") {
    const lastMonthStart = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 0));
    return { from: toUtcDateKey(lastMonthStart), to: toUtcDateKey(lastMonthEnd) };
  }
  if (filter === "LAST_3_MONTHS") {
    const start = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 2, 1));
    return { from: toUtcDateKey(start), to: todayKey };
  }
  if (filter === "LAST_7_DAYS") {
    const start = new Date(todayUtc);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: toUtcDateKey(start), to: todayKey };
  }
  if (filter === "CUSTOM_MONTH") {
    const [yearRaw, monthRaw] = customMonth.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!year || !month) return { from: null, to: null };
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return { from: toUtcDateKey(start), to: toUtcDateKey(end) };
  }

  const weekStart = new Date(todayUtc);
  const day = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - day);
  return { from: toUtcDateKey(weekStart), to: todayKey };
}

export function FinanceApp() {
  const SYNC_COOLDOWN_MS = 25000;
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busyTab, setBusyTab] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [passwordForm, setPasswordForm] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [topActionMode, setTopActionMode] = useState<"currency" | "menu">("currency");
  const [loaderStatus, setLoaderStatus] = useState("Starting...");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncRef = useRef<number>(0);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [editingExpectationId, setEditingExpectationId] = useState<string | null>(null);
  const [editingAdvancementId, setEditingAdvancementId] = useState<string | null>(null);

  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, string>>({});
  const [debouncedAdjustmentDrafts, setDebouncedAdjustmentDrafts] = useState<Record<string, string>>({});
  const [visiblePastMonths, setVisiblePastMonths] = useState(0);
  const [visibleFutureMonths, setVisibleFutureMonths] = useState(0);
  const [topDocked, setTopDocked] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  const [expenseFilterCard, setExpenseFilterCard] = useState<string>("all");
  const [expenseTimeFilter, setExpenseTimeFilter] = useState<ExpenseTimeFilter>("CURRENT_WEEK");
  const [expenseCustomMonth, setExpenseCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [expenseDisplayMode, setExpenseDisplayMode] = useState<ExpenseDisplayMode>("STORED");
  const [expenseDateTouched, setExpenseDateTouched] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    cardId: "",
    amount: "",
    currency: "USD" as Currency,
    description: ""
  });

  const [cardForm, setCardForm] = useState({ name: "", currency: "USD" as Currency, sourceType: "CREDIT_CARD" as SourceType });
  const [incomeForm, setIncomeForm] = useState({
    name: "",
    amount: "",
    currency: "USD" as Currency,
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: ""
  });
  const [fixedForm, setFixedForm] = useState({
    name: "",
    amount: "",
    currency: "USD" as Currency,
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: ""
  });
  const [expectationForm, setExpectationForm] = useState({
    cardId: "",
    month: new Date().toISOString().slice(0, 7),
    amount: "",
    currency: "ARS" as Currency,
    repeatMonths: "1"
  });
  const [advancementForm, setAdvancementForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: "",
    currency: "ARS" as Currency,
    note: ""
  });
  const [rateForm, setRateForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    arsPerUsd: ""
  });

  async function fetchBootstrap(force = true) {
    if (!force && lastSyncRef.current > 0 && Date.now() - lastSyncRef.current < SYNC_COOLDOWN_MS) {
      return;
    }
    console.info("[loader] fetching bootstrap data");
    setLoaderStatus("Loading latest data...");
    const payload = await api<Bootstrap>("/api/projections");
    const syncedAt = Date.now();
    lastSyncRef.current = syncedAt;
    setLastSyncedAt(syncedAt);
    setAuthRequired(false);
    setData(payload);
    setAdjustmentDrafts(Object.fromEntries(payload.monthlyAdjustments.map((row) => [row.month, String(row.amount)])));
    setDebouncedAdjustmentDrafts(Object.fromEntries(payload.monthlyAdjustments.map((row) => [row.month, String(row.amount)])));
    setVisiblePastMonths(0);
    setVisibleFutureMonths(0);

    if (!expenseForm.cardId && payload.cards[0]) {
      setExpenseForm((prev) => ({ ...prev, cardId: payload.cards[0].id }));
    }
    if (!expectationForm.cardId && payload.cards[0]) {
      setExpectationForm((prev) => ({ ...prev, cardId: payload.cards[0].id }));
    }
  }

  async function runTabAction(tab: Tab, action: () => Promise<void>): Promise<boolean> {
    setBusyTab(tab);
    setLoaderStatus(`Applying changes in ${tab}...`);
    console.info(`[loader] running action for tab=${tab}`);
    let success = false;
    try {
      await action();
      await fetchBootstrap(true);
      setError(null);
      success = true;
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAuthRequired(true);
        setAuthError("Session expired. Enter credentials again.");
      } else {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    } finally {
      setBusyTab(null);
    }
    return success;
  }

  useEffect(() => {
    (async () => {
      try {
        await fetchBootstrap(true);
      } catch (err) {
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
          setAuthRequired(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("finance_username");
    if (saved) {
      setAuthUsername(saved);
    }
  }, []);

  useEffect(() => {
    if (!authRequired) return;
    setPasswordFeedback(null);
  }, [authRequired]);

  useEffect(() => {
    if (!passwordFeedback) return;
    const timer = setTimeout(() => setPasswordFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [passwordFeedback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    void syncIfStale();
  }, [activeTab]);

  useEffect(() => {
    function handleFocus() {
      void syncIfStale();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void syncIfStale();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialLoading, authRequired, isSyncing]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAdjustmentDrafts(adjustmentDrafts);
    }, 350);

    return () => clearTimeout(timer);
  }, [adjustmentDrafts]);

  useEffect(() => {
    function updateDock() {
      const header = headerRef.current;
      if (!header) return;
      const bottom = header.getBoundingClientRect().bottom;
      setTopDocked(bottom <= 12);
    }

    updateDock();
    window.addEventListener("scroll", updateDock, { passive: true });
    window.addEventListener("resize", updateDock);
    return () => {
      window.removeEventListener("scroll", updateDock);
      window.removeEventListener("resize", updateDock);
    };
  }, []);

  const filteredExpenses = useMemo(() => {
    if (!data) return [];
    const bounds = expenseDateBounds(expenseTimeFilter, expenseCustomMonth);
    return data.expenses.filter((expense) => {
      const byCard = expenseFilterCard === "all" || expense.cardId === expenseFilterCard;
      const expenseDateKey = toUtcExpenseDateKey(expense.date);
      const byFrom = !bounds.from || expenseDateKey >= bounds.from;
      const byTo = !bounds.to || expenseDateKey <= bounds.to;
      return byCard && byFrom && byTo;
    });
  }, [data, expenseFilterCard, expenseTimeFilter, expenseCustomMonth]);

  const sortedIncomes = useMemo(() => {
    if (!data) return [];
    return [...data.incomes].sort((a, b) => {
      const byStart = b.startMonth.localeCompare(a.startMonth);
      if (byStart !== 0) return byStart;
      return b.name.localeCompare(a.name);
    });
  }, [data]);

  const sortedFixedExpenses = useMemo(() => {
    if (!data) return [];
    return [...data.fixedExpenses].sort((a, b) => {
      const byStart = b.startMonth.localeCompare(a.startMonth);
      if (byStart !== 0) return byStart;
      return b.name.localeCompare(a.name);
    });
  }, [data]);

  const sortedAdvancements = useMemo(() => {
    if (!data) return [];
    return [...data.advancements].sort((a, b) => b.month.localeCompare(a.month));
  }, [data]);

  const sortedExchangeRates = useMemo(() => {
    if (!data) return [];
    return [...data.exchangeRates]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [data]);

  const expectationGroups = useMemo(() => {
    if (!data) return [];

    const currentMonth = data.projection.currentMonth;
    const grouped = new Map<string, { card: Card; rows: Expectation[] }>();

    for (const row of data.expectations) {
      if (row.month < currentMonth) continue;
      const existing = grouped.get(row.cardId);
      if (existing) {
        existing.rows.push(row);
      } else {
        grouped.set(row.cardId, { card: row.card, rows: [row] });
      }
    }

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => b.month.localeCompare(a.month))
      }))
      .sort((a, b) => {
        const aLatest = a.rows[0]?.month ?? "";
        const bLatest = b.rows[0]?.month ?? "";
        const byLatest = bLatest.localeCompare(aLatest);
        if (byLatest !== 0) return byLatest;
        return b.card.name.localeCompare(a.card.name);
      });
  }, [data]);

  const forecastRows = useMemo(() => {
    if (!data) return [];
    const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);

    let savings = 0;
    return data.projection.rows.map((row) => {
      let adjustment = row.manualAdjustmentUsd;
      const editable = editableMonths.has(row.month);
      if (editable && row.month in debouncedAdjustmentDrafts) {
        const raw = debouncedAdjustmentDrafts[row.month];
        if (raw.trim() === "") {
          adjustment = 0;
        } else {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) adjustment = parsed;
        }
      }

      const net = row.incomeUsd - row.totalExpensesUsd + adjustment;
      savings += net;
      return {
        ...row,
        previewAdjustmentUsd: adjustment,
        previewNetUsd: net,
        previewSavingsUsd: savings
      };
    });
  }, [data, debouncedAdjustmentDrafts]);

  const forecastWindow = useMemo(() => {
    if (!data || forecastRows.length === 0) {
      return { rows: [], canLoadPrev: false, canLoadNext: false };
    }

    const currentYear = data.projection.currentMonth.slice(0, 4);
    const defaultStart = `${currentYear}-01`;
    const defaultEnd = `${currentYear}-12`;
    const availableStart = forecastRows[0].month;
    const availableEnd = forecastRows[forecastRows.length - 1].month;

    const requestedStart = shiftMonth(defaultStart, -visiblePastMonths);
    const requestedEnd = shiftMonth(defaultEnd, visibleFutureMonths);
    const windowStart = requestedStart < availableStart ? availableStart : requestedStart;
    const windowEnd = requestedEnd > availableEnd ? availableEnd : requestedEnd;

    return {
      rows: forecastRows.filter((row) => row.month >= windowStart && row.month <= windowEnd),
      canLoadPrev: windowStart > availableStart,
      canLoadNext: windowEnd < availableEnd
    };
  }, [data, forecastRows, visiblePastMonths, visibleFutureMonths]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);
    const trimmedUsername = authUsername.trim();
    if (!trimmedUsername) {
      setAuthError("Username is required");
      setIsAuthSubmitting(false);
      return;
    }
    setLoaderStatus(authMode === "register" ? "Creating account..." : "Authenticating...");
    console.info(`[auth] submitting ${authMode} for user=${trimmedUsername}`);
    try {
      await api(authMode === "register" ? "/api/auth/register" : "/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ username: trimmedUsername, password: authPassword })
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("finance_username", trimmedUsername);
      }
      setAuthPassword("");
      setError(null);
      setLoaderStatus("Loading your data...");
      console.info("[auth] success");
      try {
        await fetchBootstrap(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Safari can commit Set-Cookie slightly after the auth response resolves.
          await sleep(350);
          await fetchBootstrap(true);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.info("[auth] failed");
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);
    setBusyTab(activeTab);
    setLoaderStatus("Logging out...");
    console.info("[auth] logging out");
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setData(null);
      setAuthRequired(true);
      setAuthMode("login");
      setAuthPassword("");
      setPasswordFeedback(null);
      setBusyTab(null);
      setInitialLoading(false);
      setLoaderStatus("Logged out");
      setIsLoggingOut(false);
    }
  }

  function formatMoney(usdValue: number) {
    if (!data) return "-";
    if (displayCurrency === "USD") return USD_FORMAT.format(usdValue);
    return ARS_FORMAT.format(usdValue * data.projection.currentRateArsPerUsd);
  }

  function dualCurrencyMetric(usdValue: number) {
    const arsValue = usdValue * (data?.projection.currentRateArsPerUsd ?? 1);
    const primary = displayCurrency === "USD" ? USD_FORMAT.format(usdValue) : ARS_FORMAT.format(arsValue);
    const secondary = displayCurrency === "USD" ? ARS_FORMAT.format(arsValue) : USD_FORMAT.format(usdValue);
    return { primary, secondary };
  }

  function formatLastSync(value: number | null) {
    if (!value) return "--:--:--";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  }

  async function syncNow() {
    setIsSyncing(true);
    setLoaderStatus("Syncing data...");
    try {
      await fetchBootstrap(true);
      setError(null);
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAuthRequired(true);
        setAuthError("Session expired. Enter credentials again.");
      } else {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncIfStale() {
    if (initialLoading || authRequired || isSyncing) return;
    try {
      await fetchBootstrap(false);
    } catch {
      // ignore auto-refresh failures
    }
  }

  function renderTopActionSwitcher(forceMenu = false) {
    const isMenuMode = forceMenu || topActionMode === "menu";
    const isExpensesTab = activeTab === "expenses";
    return (
      <div className={`currencyToggle actionSwitcher ${isExpensesTab ? "expenseMode" : ""}`}>
        {isMenuMode ? (
          <>
            <span className="syncStatus">Synced {formatLastSync(lastSyncedAt)}</span>
            <button className="secondary syncInlineBtn" disabled={isSyncing} onClick={() => void syncNow()}>
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
            <button className="secondary logoutInlineBtn" disabled={isLoggingOut} onClick={() => void logout()}>
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </>
        ) : isExpensesTab ? (
          <>
            <span className="amountViewLabel">View</span>
            <button className={`currencyBtn ${expenseDisplayMode === "STORED" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("STORED")}>Stored</button>
            <button className={`currencyBtn ${expenseDisplayMode === "USD" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("USD")}>USD</button>
            <button className={`currencyBtn ${expenseDisplayMode === "ARS" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("ARS")}>ARS</button>
          </>
        ) : (
          <>
            <span>Currency</span>
            <button className={`currencyBtn ${displayCurrency === "USD" ? "active" : ""}`} onClick={() => setDisplayCurrency("USD")}>USD</button>
            <button className={`currencyBtn ${displayCurrency === "ARS" ? "active" : ""}`} onClick={() => setDisplayCurrency("ARS")}>ARS</button>
          </>
        )}
        {!forceMenu ? (
          <button
            type="button"
            className="menuToggleBtn"
            onClick={() => setTopActionMode((prev) => (prev === "currency" ? "menu" : "currency"))}
            aria-label="Toggle quick actions"
          >
            {topActionMode === "currency" ? "⚙" : "←"}
          </button>
        ) : null}
      </div>
    );
  }

  function trackerStatus(row: ProjectionData["cardTracker"][number]): "over" | "warning" | "ok" | "none" {
    if (row.expectedCycleUsd <= 0) return "none";
    if (row.currentCycleUsd >= row.expectedCycleUsd) return "over";
    if (row.currentCycleUsd / row.expectedCycleUsd >= 0.85) return "warning";
    return "ok";
  }

  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...expenseForm,
          dateTimeIso: expenseDateTimeIso(expenseForm.date, !expenseDateTouched),
          amount: Number(expenseForm.amount)
        })
      });
      setExpenseForm({
        date: new Date().toISOString().slice(0, 10),
        cardId: data?.cards[0]?.id ?? expenseForm.cardId,
        amount: "",
        currency: "USD",
        description: ""
      });
      setExpenseDateTouched(false);
    });
  }

  async function updateExpense(expense: Expense, originalExpense: Expense) {
    const payload: Partial<Expense> & { id: string; dateTimeIso?: string } = { id: expense.id };
    if (expense.amount !== originalExpense.amount) payload.amount = expense.amount;
    if (expense.cardId !== originalExpense.cardId) payload.cardId = expense.cardId;
    if (expense.currency !== originalExpense.currency) payload.currency = expense.currency;
    if ((expense.description ?? "") !== (originalExpense.description ?? "")) payload.description = expense.description;
    const expenseDateKey = toLocalExpenseDateKey(expense.date);
    const originalDateKey = toLocalExpenseDateKey(originalExpense.date);
    if (expenseDateKey !== originalDateKey) payload.dateTimeIso = expenseDateTimeIso(expenseDateKey, false);
    if (Object.keys(payload).length === 1) {
      setEditingExpenseId(null);
      return;
    }

    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingExpenseId(null);
    });
  }

  async function deleteExpense(id: string) {
    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitCard(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/cards", { method: "POST", body: JSON.stringify(cardForm) });
      setCardForm({ name: "", currency: "USD", sourceType: "CREDIT_CARD" });
    });
  }

  async function updateCard(card: Partial<Card> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/cards", {
        method: "PATCH",
        body: JSON.stringify(card)
      });
      setEditingCardId(null);
    });
  }

  async function toggleCard(card: Card) {
    await updateCard({ id: card.id, isActive: !card.isActive });
  }

  async function submitIncome(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/incomes", {
        method: "POST",
        body: JSON.stringify({
          ...incomeForm,
          amount: Number(incomeForm.amount),
          endMonth: incomeForm.endMonth || null
        })
      });
      setIncomeForm((prev) => ({ ...prev, name: "", amount: "", endMonth: "" }));
    });
  }

  async function updateIncome(payload: Partial<Income> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/incomes", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingIncomeId(null);
    });
  }

  async function toggleIncome(income: Income) {
    await updateIncome({ id: income.id, isActive: !income.isActive });
  }

  async function submitFixed(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/fixed-expenses", {
        method: "POST",
        body: JSON.stringify({
          ...fixedForm,
          amount: Number(fixedForm.amount),
          endMonth: fixedForm.endMonth || null
        })
      });
      setFixedForm((prev) => ({ ...prev, name: "", amount: "", endMonth: "" }));
    });
  }

  async function updateFixed(payload: Partial<FixedExpense> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/fixed-expenses", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingFixedId(null);
    });
  }

  async function toggleFixed(item: FixedExpense) {
    await updateFixed({ id: item.id, isActive: !item.isActive });
  }

  async function submitExpectation(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "POST",
        body: JSON.stringify({
          ...expectationForm,
          amount: Number(expectationForm.amount),
          repeatMonths: Number(expectationForm.repeatMonths)
        })
      });
      setExpectationForm((prev) => ({ ...prev, amount: "" }));
    });
  }

  async function updateExpectation(payload: Partial<Expectation> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingExpectationId(null);
    });
  }

  async function deleteExpectation(id: string) {
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitAdvancement(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "POST",
        body: JSON.stringify({
          ...advancementForm,
          amount: Number(advancementForm.amount)
        })
      });
      setAdvancementForm((prev) => ({ ...prev, amount: "", note: "" }));
    });
  }

  async function updateAdvancement(payload: Partial<Advancement> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingAdvancementId(null);
    });
  }

  async function deleteAdvancement(id: string) {
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitRate(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/exchange-rates", {
        method: "POST",
        body: JSON.stringify({
          ...rateForm,
          arsPerUsd: Number(rateForm.arsPerUsd),
          source: "manual"
        })
      });
      setRateForm((prev) => ({ ...prev, arsPerUsd: "" }));
    });
  }

  async function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordForm.trim()) {
      setPasswordFeedback("Password cannot be empty.");
      return;
    }

    setPasswordFeedback(null);
    const ok = await runTabAction("settings", async () => {
      await api("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ password: passwordForm })
      });
    });

    if (ok) {
      setPasswordForm("");
      setPasswordFeedback("Password updated.");
    }
  }

  async function syncRate() {
    await runTabAction("settings", async () => {
      await api("/api/exchange-rates/fetch", { method: "POST" });
    });
  }

  async function saveAdjustment(month: string) {
    const raw = adjustmentDrafts[month] ?? "";
    await runTabAction("forecast", async () => {
      if (!raw.trim()) {
        await api("/api/monthly-adjustments", {
          method: "DELETE",
          body: JSON.stringify({ month })
        });
        return;
      }

      await api("/api/monthly-adjustments", {
        method: "PUT",
        body: JSON.stringify({
          month,
          amount: Number(raw),
          currency: "USD",
          note: "manual month correction"
        })
      });
    });
  }

  if (initialLoading) {
    return (
      <main className="container">
        <section className="panel authPanel">
          <div className="authLoading">
            <div className="spinner" />
            <h2>Loading</h2>
            <p>{loaderStatus}</p>
          </div>
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="container">
        <section className="panel authPanel">
          <div className="authHeader">
            <h2>{authMode === "register" ? "Create Account" : "Welcome Back"}</h2>
            <p className="subtle">{authMode === "register" ? "Create a new user and password to start." : "Sign in with your username and password."}</p>
          </div>
          <div className="authModeSwitch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              disabled={isAuthSubmitting}
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              disabled={isAuthSubmitting}
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
            >
              Create User
            </button>
          </div>
          <form className="formGrid authForm" onSubmit={submitAuth}>
            <label className="fieldLabel">
              <span>Username</span>
              <input
                type="text"
                placeholder="julian"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={isAuthSubmitting}
                required
              />
            </label>
            <label className="fieldLabel">
              <span>Password</span>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                disabled={isAuthSubmitting}
                required
              />
            </label>
            <button type="submit" disabled={isAuthSubmitting}>
              {isAuthSubmitting ? (authMode === "register" ? "Creating..." : "Signing in...") : authMode === "register" ? "Create User" : "Sign In"}
            </button>
          </form>
          {isAuthSubmitting ? <p className="subtle authStatus">{loaderStatus}</p> : null}
          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container">
        <h1>Personal Finance Forecasting</h1>
        <p className="error">{error || "Unknown error"}</p>
        <button
          onClick={() => {
            setInitialLoading(true);
            setError(null);
            void (async () => {
              try {
                await fetchBootstrap();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load data");
              } finally {
                setInitialLoading(false);
              }
            })();
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  const trackerRemainingUsdTotal = data.projection.cardTracker.reduce(
    (acc, row) => acc + Math.max(row.remainingExpectedUsd, 0),
    0
  );
  const trackerRemainingMetric = dualCurrencyMetric(trackerRemainingUsdTotal);

  return (
    <main className="container">
      <header className="header" ref={headerRef}>
        <h1>Personal Finance Forecasting</h1>
        <p>Track expenses now, project next-month cash impact, and reconcile real closes.</p>
        {data.currentUser ? (
          <div className="activeUserBadge" title="Authenticated user">
            User: {data.currentUser.username}
          </div>
        ) : null}
      </header>

      <div className={`desktopOnly topSticky ${topDocked ? "isDocked" : ""}`}>
        <div className="toolbar">
          <div className="tabs">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={activeTab === "tracker" ? "active" : ""} onClick={() => setActiveTab("tracker")}>All Expense Tracking</button>
            <button className={activeTab === "expenses" ? "active" : ""} onClick={() => setActiveTab("expenses")}>Expense Log</button>
            <button className={activeTab === "forecast" ? "active" : ""} onClick={() => setActiveTab("forecast")}>Forecast</button>
            <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>Settings</button>
          </div>
          <div className="toolbarRight">{renderTopActionSwitcher(activeTab === "settings")}</div>
        </div>
      </div>

      <div className={`mobileOnly topStickyMobile ${topDocked ? "isDocked" : ""}`}>
        <div className="mobileTopBar">
          {renderTopActionSwitcher(activeTab === "settings")}
        </div>
      </div>

      <div className={`sectionWrap ${busyTab === activeTab ? "isBusy" : ""} ${topDocked ? "withTopDockOffset" : ""}`}>
        {busyTab === activeTab && (
          <div className="busyOverlay">
            <div className="spinner" />
            <span>{loaderStatus}</span>
          </div>
        )}

        {activeTab === "dashboard" && (
          <section className="grid4">
            <article className="metric">
              <h3>Current Month Income</h3>
              <strong>{dualCurrencyMetric(data.projection.dashboard.incomeUsd).primary}</strong>
              <small>{dualCurrencyMetric(data.projection.dashboard.incomeUsd).secondary}</small>
            </article>
            <article className="metric">
              <h3>Current Month Expenses</h3>
              <strong>{dualCurrencyMetric(data.projection.dashboard.expectedExpensesUsd).primary}</strong>
              <small>{dualCurrencyMetric(data.projection.dashboard.expectedExpensesUsd).secondary}</small>
            </article>
            <article className="metric">
              <h3>Projected Net (Current)</h3>
              <strong>{dualCurrencyMetric(data.projection.dashboard.projectedSavingsUsd).primary}</strong>
              <small>{dualCurrencyMetric(data.projection.dashboard.projectedSavingsUsd).secondary}</small>
            </article>
            <article className="metric">
              <h3>Next Card Payment (1st)</h3>
              <strong>{dualCurrencyMetric(data.projection.dashboard.nextCardPaymentUsd).primary}</strong>
              <small>{dualCurrencyMetric(data.projection.dashboard.nextCardPaymentUsd).secondary}</small>
            </article>
          </section>
        )}

        {activeTab === "tracker" && (
          <section className="panel">
            <h2>
              Current Spending Cycle ({toMonthLabel(data.projection.currentMonth)}) · Paid on 1st of {toMonthLabel(data.projection.paymentMonth)}
            </h2>
            <p className="subtle">Expected values are tied to payment month. FX reference: {data.projection.currentRateArsPerUsd.toFixed(2)} ARS/USD.</p>
            <article className="trackerTotalHero">
              <h3>Total Remaining to Spend</h3>
              <strong>{trackerRemainingMetric.primary}</strong>
              <small>{trackerRemainingMetric.secondary}</small>
            </article>
            <table className="desktopOnly desktopTable forecastTable">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Remaining</th>
                  <th>Expected Payment Month</th>
                  <th>Current Spending</th>
                  <th>Last Expense</th>
                </tr>
              </thead>
              <tbody>
                {data.projection.cardTracker.map((row) => (
                  <tr key={row.cardId} className={`trackerRow tracker-${trackerStatus(row)}`}>
                    <td>
                      <span className="trackerName">
                        <SourceBadge sourceType={data.cards.find((card) => card.id === row.cardId)?.sourceType} />
                        {row.cardName}
                      </span>
                      <span className={`trackerBadge tracker-${trackerStatus(row)}`}>
                        {trackerStatus(row) === "over" ? "Over limit" : trackerStatus(row) === "warning" ? "Near limit" : trackerStatus(row) === "ok" ? "Healthy" : "No target"}
                      </span>
                    </td>
                    <td className={`trackerRemaining tracker-${trackerStatus(row)}`}>
                      {row.expectedCycleUsd <= 0 ? (
                        <span className="subtle">No tracking target</span>
                      ) : (
                        displayCurrency === "USD" ? USD_FORMAT.format(row.remainingExpectedUsd) : ARS_FORMAT.format(row.remainingExpectedArs)
                      )}
                    </td>
                    <td>{displayCurrency === "USD" ? USD_FORMAT.format(row.expectedCycleUsd) : ARS_FORMAT.format(row.expectedCycleArs)}</td>
                    <td>{displayCurrency === "USD" ? USD_FORMAT.format(row.currentCycleUsd) : ARS_FORMAT.format(row.currentCycleArs)}</td>
                    <td>{toLocalDateTimeLabel(row.lastExpenseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mobileOnly">
              {data.projection.cardTracker.map((row) => (
                <article key={row.cardId} className={`mobileCard tracker-${trackerStatus(row)}`}>
                  <h3><SourceBadge sourceType={data.cards.find((card) => card.id === row.cardId)?.sourceType} /> {row.cardName}</h3>
                  <p className={`trackerBadge tracker-${trackerStatus(row)}`}>
                    {trackerStatus(row) === "over" ? "Over limit" : trackerStatus(row) === "warning" ? "Near limit" : trackerStatus(row) === "ok" ? "Healthy margin" : "No target"}
                  </p>
                  {row.expectedCycleUsd <= 0 ? (
                    <p className="mobileMain tracker-none">No tracking target</p>
                  ) : (
                    <>
                      <p className={`mobileMain trackerRemaining tracker-${trackerStatus(row)}`}>
                        {displayCurrency === "USD" ? USD_FORMAT.format(row.remainingExpectedUsd) : ARS_FORMAT.format(row.remainingExpectedArs)}
                      </p>
                      <p className="subtle">Remaining to spend</p>
                    </>
                  )}
                  <details>
                    <summary>Details</summary>
                    <p>Expected: {displayCurrency === "USD" ? USD_FORMAT.format(row.expectedCycleUsd) : ARS_FORMAT.format(row.expectedCycleArs)}</p>
                    <p>Current spending: {displayCurrency === "USD" ? USD_FORMAT.format(row.currentCycleUsd) : ARS_FORMAT.format(row.currentCycleArs)}</p>
                    <p>Last expense: {toLocalDateTimeLabel(row.lastExpenseDate)}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "expenses" && (
          <section className="stack">
            <article className="panel">
              <h2>Add Expense</h2>
              <form className="formGrid" onSubmit={submitExpense}>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(event) => {
                    setExpenseDateTouched(true);
                    setExpenseForm((prev) => ({ ...prev, date: event.target.value }));
                  }}
                  required
                />
                <select value={expenseForm.cardId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, cardId: event.target.value }))} required>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                <input type="number" step="0.01" placeholder="Amount" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={expenseForm.currency} onChange={(event) => setExpenseForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input placeholder="Description (optional)" value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Save Expense</button>
              </form>
            </article>

            <article className="panel">
              <h2>Expense Log</h2>
              <div className="filters">
                <select value={expenseFilterCard} onChange={(event) => setExpenseFilterCard(event.target.value)}>
                  <option value="all">All sources</option>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                {expenseFilterCard === "all" ? (
                  <p className="subtle sourcePreview"><span className="sourceBadge sourceType-other">All Sources</span></p>
                ) : findCardById(data.cards, expenseFilterCard) ? (
                  <p className="subtle sourcePreview">
                    <SourceBadge sourceType={findCardById(data.cards, expenseFilterCard)?.sourceType} />
                  </p>
                ) : null}
                <select value={expenseTimeFilter} onChange={(event) => setExpenseTimeFilter(event.target.value as ExpenseTimeFilter)}>
                  {EXPENSE_TIME_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {expenseTimeFilter === "CUSTOM_MONTH" ? (
                  <input type="month" value={expenseCustomMonth} onChange={(event) => setExpenseCustomMonth(event.target.value)} />
                ) : null}
              </div>
              <table className="desktopOnly desktopTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      cards={data.cards}
                      expenseDisplayMode={expenseDisplayMode}
                      arsPerUsd={data.projection.currentRateArsPerUsd}
                      isEditing={editingExpenseId === expense.id}
                      onStartEdit={() => setEditingExpenseId(expense.id)}
                      onCancelEdit={() => setEditingExpenseId(null)}
                      onSave={updateExpense}
                      onDelete={deleteExpense}
                    />
                  ))}
                </tbody>
              </table>
              <div className="mobileOnly">
                {filteredExpenses.map((expense) => (
                  <MobileExpenseCard
                    key={expense.id}
                    expense={expense}
                    cards={data.cards}
                    expenseDisplayMode={expenseDisplayMode}
                    arsPerUsd={data.projection.currentRateArsPerUsd}
                    onSave={updateExpense}
                    onDelete={deleteExpense}
                  />
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "forecast" && (
          <section className="panel">
            <h2>Financial Forecast ({data.projection.rows.length} months)</h2>
            <p className="subtle">Shows full current year by default (Jan to Dec). Load previous/next in chunks of 3. Adjustment is editable only for current and previous month.</p>
            {forecastWindow.canLoadPrev || forecastWindow.canLoadNext ? (
              <div className="forecastActions">
                {forecastWindow.canLoadPrev ? (
                  <button className="secondary" onClick={() => setVisiblePastMonths((prev) => prev + 3)}>Load previous</button>
                ) : null}
                {forecastWindow.canLoadNext ? (
                  <button className="secondary" onClick={() => setVisibleFutureMonths((prev) => prev + 3)}>Load next</button>
                ) : null}
              </div>
            ) : null}
            <table className="desktopOnly desktopTable">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Fixed</th>
                  <th>Card Payment</th>
                  <th>Advancement Impact</th>
                  <th>Adjustment (USD)</th>
                  <th>Total Expenses</th>
                  <th>Net</th>
                  <th>Savings</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {forecastWindow.rows.map((row) => {
                  const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);
                  const editable = editableMonths.has(row.month);
                  return (
                    <tr key={row.month} className={row.month === data.projection.currentMonth ? "currentMonthRow" : ""}>
                      <td>
                        {toMonthLabel(row.month)}
                        {row.month === data.projection.currentMonth ? <span className="currentCycleBadge">Current cycle</span> : null}
                      </td>
                      <td>{formatMoney(row.incomeUsd)}</td>
                      <td>{formatMoney(row.fixedExpensesUsd)}</td>
                      <td>{formatMoney(row.cardPaymentUsd)}</td>
                      <td>{formatMoney(row.advancementImpactUsd)}</td>
                      <td>
                        {editable ? (
                          <input
                            type="number"
                            step="0.01"
                            value={adjustmentDrafts[row.month] ?? ""}
                            onChange={(event) => setAdjustmentDrafts((prev) => ({ ...prev, [row.month]: event.target.value }))}
                            placeholder="0"
                          />
                        ) : (
                          USD_FORMAT.format(row.previewAdjustmentUsd)
                        )}
                      </td>
                      <td>{formatMoney(row.totalExpensesUsd)}</td>
                      <td>{formatMoney(row.previewNetUsd)}</td>
                      <td>{formatMoney(row.previewSavingsUsd)}</td>
                      <td>{editable ? <button className="tiny" onClick={() => void saveAdjustment(row.month)}>Save</button> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mobileOnly">
              {forecastWindow.rows.map((row) => {
                const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);
                const editable = editableMonths.has(row.month);
                return (
                  <article key={row.month} className={`mobileCard ${row.month === data.projection.currentMonth ? "currentMonthCard" : ""}`}>
                    <h3>
                      {toMonthLabel(row.month)}
                      {row.month === data.projection.currentMonth ? <span className="currentCycleBadge">Current cycle</span> : null}
                    </h3>
                    <p className="mobileMain">{formatMoney(row.previewNetUsd)}</p>
                    <p className="subtle">Net for month</p>
                    <details>
                      <summary>Income / Expenses</summary>
                      <p>Income: {formatMoney(row.incomeUsd)}</p>
                      <p>Fixed: {formatMoney(row.fixedExpensesUsd)}</p>
                      <p>Card payment: {formatMoney(row.cardPaymentUsd)}</p>
                      <p>Advancement: {formatMoney(row.advancementImpactUsd)}</p>
                      <p>Total expenses: {formatMoney(row.totalExpensesUsd)}</p>
                      <p>Savings: {formatMoney(row.previewSavingsUsd)}</p>
                    </details>
                    {editable ? (
                      <div className="mobileInline">
                        <input
                          type="number"
                          step="0.01"
                          value={adjustmentDrafts[row.month] ?? ""}
                          onChange={(event) => setAdjustmentDrafts((prev) => ({ ...prev, [row.month]: event.target.value }))}
                          placeholder="Adjustment USD"
                        />
                        <button className="tiny" onClick={() => void saveAdjustment(row.month)}>Save</button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="stack">
            <article className="panel settingsAccount">
              <h2>Account Security</h2>
              <form className="formGrid" onSubmit={submitPasswordChange}>
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordForm}
                  onChange={(event) => setPasswordForm(event.target.value)}
                  required
                />
                <button type="submit">Update Password</button>
              </form>
              {passwordFeedback ? <p className="subtle">{passwordFeedback}</p> : null}
            </article>

            <article className="panel settingsCards">
              <h2>Expense Sources</h2>
              <form className="formGrid" onSubmit={submitCard}>
                <input placeholder="Source name" value={cardForm.name} onChange={(event) => setCardForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <select value={cardForm.currency} onChange={(event) => setCardForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <select value={cardForm.sourceType} onChange={(event) => setCardForm((prev) => ({ ...prev, sourceType: event.target.value as SourceType }))}>
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
                  ))}
                </select>
                <button type="submit">Add Source</button>
              </form>
              <ul className="accordionList">
                {data.cards.map((card) => (
                  <details key={card.id} className="itemAccordion">
                    <summary>
                      <span><SourceBadge sourceType={card.sourceType} /> {card.name}</span>
                      <span className="subtle">{sourceTypeLabel(card.sourceType)} · {card.currency} · {card.isActive ? "active" : "inactive"}</span>
                    </summary>
                    <ul>
                      <EditableCardRow
                        card={card}
                        isEditing={editingCardId === card.id}
                        onEdit={() => setEditingCardId(card.id)}
                        onCancel={() => setEditingCardId(null)}
                        onSave={updateCard}
                        onToggle={() => void toggleCard(card)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsIncome">
              <h2>Income Sources</h2>
              <form className="formGrid" onSubmit={submitIncome}>
                <input placeholder="Income name" value={incomeForm.name} onChange={(event) => setIncomeForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Amount" value={incomeForm.amount} onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={incomeForm.currency} onChange={(event) => setIncomeForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <label className="fieldLabel"><span>Start month</span><input type="month" value={incomeForm.startMonth} onChange={(event) => setIncomeForm((prev) => ({ ...prev, startMonth: event.target.value }))} required /></label>
                <label className="fieldLabel"><span>End month</span><input type="month" value={incomeForm.endMonth} onChange={(event) => setIncomeForm((prev) => ({ ...prev, endMonth: event.target.value }))} /></label>
                <button type="submit">Add Income</button>
              </form>
              <ul className="accordionList">
                {sortedIncomes.map((income) => (
                  <details key={income.id} className="itemAccordion">
                    <summary>
                      <span>{income.name}</span>
                      <span className="subtle">{income.amount} {income.currency}</span>
                    </summary>
                    <ul>
                      <EditableIncomeRow
                        income={income}
                        isEditing={editingIncomeId === income.id}
                        onEdit={() => setEditingIncomeId(income.id)}
                        onCancel={() => setEditingIncomeId(null)}
                        onSave={updateIncome}
                        onToggle={() => void toggleIncome(income)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsFixed">
              <h2>Fixed Expenses</h2>
              <form className="formGrid" onSubmit={submitFixed}>
                <input placeholder="Expense name" value={fixedForm.name} onChange={(event) => setFixedForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Amount" value={fixedForm.amount} onChange={(event) => setFixedForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={fixedForm.currency} onChange={(event) => setFixedForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <label className="fieldLabel"><span>Start month</span><input type="month" value={fixedForm.startMonth} onChange={(event) => setFixedForm((prev) => ({ ...prev, startMonth: event.target.value }))} required /></label>
                <label className="fieldLabel"><span>End month</span><input type="month" value={fixedForm.endMonth} onChange={(event) => setFixedForm((prev) => ({ ...prev, endMonth: event.target.value }))} /></label>
                <button type="submit">Add Fixed</button>
              </form>
              <ul className="accordionList">
                {sortedFixedExpenses.map((fixed) => (
                  <details key={fixed.id} className="itemAccordion">
                    <summary>
                      <span>{fixed.name}</span>
                      <span className="subtle">{fixed.amount} {fixed.currency}</span>
                    </summary>
                    <ul>
                      <EditableFixedRow
                        item={fixed}
                        isEditing={editingFixedId === fixed.id}
                        onEdit={() => setEditingFixedId(fixed.id)}
                        onCancel={() => setEditingFixedId(null)}
                        onSave={updateFixed}
                        onToggle={() => void toggleFixed(fixed)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsExpectations">
              <h2>Expected Source Spending (Payment Month)</h2>
              <form className="formGrid" onSubmit={submitExpectation}>
                <select value={expectationForm.cardId} onChange={(event) => setExpectationForm((prev) => ({ ...prev, cardId: event.target.value }))} required>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                <label className="fieldLabel"><span>Payment month</span><input type="month" value={expectationForm.month} onChange={(event) => setExpectationForm((prev) => ({ ...prev, month: event.target.value }))} required /></label>
                <input type="number" step="0.01" placeholder="Expected amount" value={expectationForm.amount} onChange={(event) => setExpectationForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={expectationForm.currency} onChange={(event) => setExpectationForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input type="number" min="1" max="36" placeholder="Repeat N months" value={expectationForm.repeatMonths} onChange={(event) => setExpectationForm((prev) => ({ ...prev, repeatMonths: event.target.value }))} />
                <button type="submit">Save Expectation</button>
              </form>
              {expectationGroups.length === 0 ? (
                <p className="subtle">No current/future expectations yet.</p>
              ) : (
                <div className="expectationAccordionStack">
                  {expectationGroups.map((group) => (
                    <details key={group.card.id} className="expectationAccordion">
                      <summary>
                        <span><SourceBadge sourceType={group.card.sourceType} /> {group.card.name}</span>
                        <span className="subtle">{group.rows.length} month{group.rows.length === 1 ? "" : "s"}</span>
                      </summary>
                      <ul className="accordionList">
                        {group.rows.map((row) => (
                          <details key={row.id} className="itemAccordion">
                            <summary>
                              <span>{toMonthLabel(row.month)}</span>
                              <span className="subtle">{row.amount} {row.currency}</span>
                            </summary>
                            <ul>
                              <EditableExpectationRow
                                row={row}
                                cards={data.cards}
                                isEditing={editingExpectationId === row.id}
                                onEdit={() => setEditingExpectationId(row.id)}
                                onCancel={() => setEditingExpectationId(null)}
                                onSave={updateExpectation}
                                onDelete={() => void deleteExpectation(row.id)}
                              />
                            </ul>
                          </details>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </article>

            <article className="panel settingsAdvancements">
              <h2>Advancements (Affect Next Month)</h2>
              <form className="formGrid" onSubmit={submitAdvancement}>
                <label className="fieldLabel"><span>Advancement month</span><input type="month" value={advancementForm.month} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, month: event.target.value }))} required /></label>
                <input type="number" step="0.01" placeholder="Amount" value={advancementForm.amount} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={advancementForm.currency} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input placeholder="Note (optional)" value={advancementForm.note} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, note: event.target.value }))} />
                <button type="submit">Add Advancement</button>
              </form>
              <ul className="accordionList">
                {sortedAdvancements.map((row) => (
                  <details key={row.id} className="itemAccordion">
                    <summary>
                      <span>{toMonthLabel(row.month)}</span>
                      <span className="subtle">{row.amount} {row.currency}</span>
                    </summary>
                    <ul>
                      <EditableAdvancementRow
                        row={row}
                        isEditing={editingAdvancementId === row.id}
                        onEdit={() => setEditingAdvancementId(row.id)}
                        onCancel={() => setEditingAdvancementId(null)}
                        onSave={updateAdvancement}
                        onToggle={() => void updateAdvancement({ id: row.id, isActive: !row.isActive })}
                        onDelete={() => void deleteAdvancement(row.id)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsExchange">
              <h2>Exchange Rate (ARS per USD)</h2>
              <form className="formGrid" onSubmit={submitRate}>
                <input type="date" value={rateForm.date} onChange={(event) => setRateForm((prev) => ({ ...prev, date: event.target.value }))} required />
                <input type="number" step="0.000001" placeholder="ARS per USD" value={rateForm.arsPerUsd} onChange={(event) => setRateForm((prev) => ({ ...prev, arsPerUsd: event.target.value }))} required />
                <button type="submit">Save Rate</button>
                <button type="button" className="secondary" onClick={() => void syncRate()}>Fetch from API</button>
              </form>
              <ul className="accordionList">
                {sortedExchangeRates.map((rate) => (
                  <details key={rate.date} className="itemAccordion">
                    <summary>
                      <span>{rate.date}</span>
                      <span className="subtle">{rate.arsPerUsd.toFixed(4)}</span>
                    </summary>
                    <div className="listRow">
                      <span>Source: {rate.source ?? "manual"}</span>
                    </div>
                  </details>
                ))}
              </ul>
            </article>
          </section>
        )}
      </div>
      <nav className="bottomTabs mobileOnly">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => {
              triggerHaptic();
              setActiveTab(tab.id);
            }}
          >
            <span className="bottomTabIcon" aria-hidden>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ExpenseRow({ expense, cards, expenseDisplayMode, arsPerUsd, isEditing, onStartEdit, onCancelEdit, onSave, onDelete }: {
  expense: Expense;
  cards: Card[];
  expenseDisplayMode: ExpenseDisplayMode;
  arsPerUsd: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (expense: Expense, originalExpense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Expense>({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  const targetCurrency = expenseDisplayMode === "STORED" ? expense.currency : expenseDisplayMode;
  const convertedAmount =
    targetCurrency === expense.currency
      ? expense.amount
      : expense.currency === "USD"
        ? expense.amount * arsPerUsd
        : expense.amount / arsPerUsd;
  const mainLabel = targetCurrency === "USD" ? USD_FORMAT.format(convertedAmount) : ARS_FORMAT.format(convertedAmount);
  const originalLabel = formatCodeAmount(expense.amount, expense.currency);
  const showOriginal = expenseDisplayMode !== "STORED";

  useEffect(() => {
    setDraft({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  }, [expense]);

  if (isEditing) {
    return (
      <tr>
        <td><input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} /></td>
        <td><select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>{cards.map((card) => <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>)}</select></td>
        <td><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /></td>
        <td><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select></td>
        <td><input value={draft.description ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} /></td>
        <td className="rowButtons"><button onClick={() => void onSave(draft, expense)}>Save</button><button className="secondary" onClick={onCancelEdit}>Cancel</button></td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{toLocalDateTimeLabel(expense.date)}</td>
      <td><SourceBadge sourceType={expense.card.sourceType} /> {expense.card.name}</td>
      <td>
        <div className="amountCell">
          <span>{mainLabel}</span>
          {showOriginal ? <small className="subtle">Real: {originalLabel}</small> : null}
        </div>
      </td>
      <td>{expense.currency}</td>
      <td>{expense.description || "-"}</td>
      <td className="rowButtons"><button onClick={onStartEdit}>Edit</button><button className="secondary" onClick={() => void onDelete(expense.id)}>Delete</button></td>
    </tr>
  );
}

function MobileExpenseCard({
  expense,
  cards,
  expenseDisplayMode,
  arsPerUsd,
  onSave,
  onDelete
}: {
  expense: Expense;
  cards: Card[];
  expenseDisplayMode: ExpenseDisplayMode;
  arsPerUsd: number;
  onSave: (expense: Expense, originalExpense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Expense>({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  const targetCurrency = expenseDisplayMode === "STORED" ? expense.currency : expenseDisplayMode;
  const convertedAmount =
    targetCurrency === expense.currency
      ? expense.amount
      : expense.currency === "USD"
        ? expense.amount * arsPerUsd
        : expense.amount / arsPerUsd;
  const mainLabel = targetCurrency === "USD" ? USD_FORMAT.format(convertedAmount) : ARS_FORMAT.format(convertedAmount);
  const originalLabel = formatCodeAmount(expense.amount, expense.currency);
  const showOriginal = expenseDisplayMode !== "STORED";

  useEffect(() => {
    setDraft({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  }, [expense]);

  if (isEditing) {
    return (
      <article className="mobileCard">
        <h3>Edit Expense</h3>
        <div className="mobileInline">
          <input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} />
          <select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
            ))}
          </select>
          <input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} />
          <select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
          <input value={draft.description ?? ""} placeholder="Description" onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} />
          <button onClick={() => void onSave(draft, expense).then(() => setIsEditing(false))}>Save</button>
          <button className="secondary" onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </article>
    );
  }

  return (
    <article className="mobileCard">
      <h3><SourceBadge sourceType={expense.card.sourceType} /> {expense.card.name}</h3>
      <p className="mobileMain">{mainLabel}</p>
      {showOriginal ? <p className="subtle">Real: {originalLabel}</p> : null}
      <p className="subtle">Currency: {expense.currency}</p>
      <p className="subtle">{toLocalDateTimeLabel(expense.date)}</p>
      <details>
        <summary>Details</summary>
        <p>Description: {expense.description || "-"}</p>
      </details>
      <div className="rowButtons">
        <button onClick={() => setIsEditing(true)}>Edit</button>
        <button className="secondary" onClick={() => void onDelete(expense.id)}>Delete</button>
      </div>
    </article>
  );
}

function SourceBadge({ sourceType }: { sourceType: SourceType | string | null | undefined }) {
  const meta = sourceTypeMeta(sourceType);
  return (
    <span className={`sourceBadge sourceType-${meta.value.toLowerCase()}`}>
      <SourceTypeGlyph sourceType={meta.value} className="sourceBadgeIcon" />
      <span>{meta.short}</span>
    </span>
  );
}

function EditableCardRow({ card, isEditing, onEdit, onCancel, onSave, onToggle }: {
  card: Card;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Card> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(card);
  useEffect(() => setDraft(card), [card]);
  return (
    <li className="listRow">
      {isEditing ? (
        <>
          <div className="inlineForm">
            <input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
            <select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <select value={draft.sourceType} onChange={(event) => setDraft((prev) => ({ ...prev, sourceType: event.target.value as SourceType }))}>
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
              ))}
            </select>
          </div>
          <div className="rowButtons">
            <button onClick={() => void onSave({ id: card.id, name: draft.name, currency: draft.currency, sourceType: draft.sourceType })}>Save</button>
            <button className="secondary" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <span><SourceBadge sourceType={card.sourceType} /> {card.name} ({sourceTypeLabel(card.sourceType)} · {card.currency})</span>
          <div className="rowButtons">
            <button onClick={onEdit}>Edit</button>
            <button className="secondary" onClick={onToggle}>{card.isActive ? "Deactivate" : "Activate"}</button>
          </div>
        </>
      )}
    </li>
  );
}

function EditableIncomeRow({ income, isEditing, onEdit, onCancel, onSave, onToggle }: {
  income: Income;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Income> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(income);
  useEffect(() => setDraft(income), [income]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><label className="fieldLabel"><span>Start month</span><input type="month" value={draft.startMonth} onChange={(event) => setDraft((prev) => ({ ...prev, startMonth: event.target.value }))} /></label><label className="fieldLabel"><span>End month</span><input type="month" value={draft.endMonth ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, endMonth: event.target.value || null }))} /></label></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: income.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{income.name}: {income.amount} {income.currency} ({income.startMonth}{income.endMonth ? ` to ${income.endMonth}` : " onward"})</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{income.isActive ? "Disable" : "Enable"}</button></div></>}</li>;
}

function EditableFixedRow({ item, isEditing, onEdit, onCancel, onSave, onToggle }: {
  item: FixedExpense;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<FixedExpense> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(item);
  useEffect(() => setDraft(item), [item]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><label className="fieldLabel"><span>Start month</span><input type="month" value={draft.startMonth} onChange={(event) => setDraft((prev) => ({ ...prev, startMonth: event.target.value }))} /></label><label className="fieldLabel"><span>End month</span><input type="month" value={draft.endMonth ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, endMonth: event.target.value || null }))} /></label></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: item.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{item.name}: {item.amount} {item.currency} ({item.startMonth}{item.endMonth ? ` to ${item.endMonth}` : " onward"})</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{item.isActive ? "Disable" : "Enable"}</button></div></>}</li>;
}

function EditableExpectationRow({ row, cards, isEditing, onEdit, onCancel, onSave, onDelete }: {
  row: Expectation;
  cards: Card[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Expectation> & { id: string }) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>{cards.map((card) => <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>)}</select><label className="fieldLabel"><span>Payment month</span><input type="month" value={draft.month} onChange={(event) => setDraft((prev) => ({ ...prev, month: event.target.value }))} /></label><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: row.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span><SourceBadge sourceType={row.card.sourceType} /> {row.card.name} - {row.month}: {row.amount} {row.currency}</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onDelete}>Delete</button></div></>}</li>;
}

function EditableAdvancementRow({ row, isEditing, onEdit, onCancel, onSave, onToggle, onDelete }: {
  row: Advancement;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Advancement> & { id: string }) => Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><label className="fieldLabel"><span>Advancement month</span><input type="month" value={draft.month} onChange={(event) => setDraft((prev) => ({ ...prev, month: event.target.value }))} /></label><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><input placeholder="Note" value={draft.note ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))} /></div><div className="rowButtons"><button onClick={() => void onSave({ id: row.id, month: draft.month, amount: draft.amount, currency: draft.currency, note: draft.note })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{row.month}: {row.amount} {row.currency}{row.note ? ` (${row.note})` : ""}</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{row.isActive ? "Disable" : "Enable"}</button><button className="secondary" onClick={onDelete}>Delete</button></div></>}</li>;
}
