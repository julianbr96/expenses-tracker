import { prisma } from "@/lib/db";
import { amountSchema, currencySchema } from "@/lib/api";
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

export async function GET() {
  const expenses = await prisma.expense.findMany({
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
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dateTimeIso, date, ...rest } = parsed.data;

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
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, dateTimeIso, date, ...changes } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...changes,
      date: dateTimeIso
        ? new Date(dateTimeIso)
        : date
          ? new Date(`${date}T00:00:00.000Z`)
          : undefined
    }
  });

  return NextResponse.json({ ...expense, amount: Number(expense.amount) });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.expense.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
