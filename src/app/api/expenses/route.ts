import { prisma } from "@/lib/db";
import { amountSchema, currencySchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  date: z.string().date(),
  dateTimeIso: z.string().datetime().optional(),
  cardId: z.string().min(1),
  amount: amountSchema,
  currency: currencySchema,
  description: z.string().max(500).optional().nullable()
});

const updateSchema = z.object({
  id: z.string().min(1),
  date: z.string().date().optional(),
  dateTimeIso: z.string().datetime().optional(),
  cardId: z.string().min(1).optional(),
  amount: amountSchema.optional(),
  currency: currencySchema.optional(),
  description: z.string().max(500).optional().nullable()
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const expenses = await prisma.expense.findMany({
    where: { card: { userId: auth.userId } },
    include: { card: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json(
    expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      date: expense.date.toISOString().slice(0, 10)
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dateTimeIso, date, ...rest } = parsed.data;

  const card = await prisma.card.findFirst({
    where: { id: rest.cardId, userId: auth.userId },
    select: { id: true }
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const expense = await prisma.expense.create({
    data: {
      ...rest,
      description: rest.description || null,
      date: dateTimeIso
        ? new Date(dateTimeIso)
        : new Date(`${date}T00:00:00.000Z`)
    }
  });

  return NextResponse.json(expense, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, dateTimeIso, date, ...changes } = parsed.data;
  if (changes.cardId) {
    const card = await prisma.card.findFirst({
      where: { id: changes.cardId, userId: auth.userId },
      select: { id: true }
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
  }

  const update = await prisma.expense.updateMany({
    where: { id, card: { userId: auth.userId } },
    data: {
      ...changes,
      date: dateTimeIso
        ? new Date(dateTimeIso)
        : date
          ? new Date(`${date}T00:00:00.000Z`)
          : undefined
    }
  });
  if (update.count === 0) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ ...expense, amount: Number(expense.amount) });
}

export async function DELETE(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.expense.deleteMany({ where: { id: parsed.data.id, card: { userId: auth.userId } } });
  return NextResponse.json({ ok: true });
}
