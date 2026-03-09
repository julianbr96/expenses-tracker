import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { addMonths } from "@/lib/time";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  cardId: z.string().min(1),
  month: monthSchema,
  amount: amountSchema,
  currency: currencySchema,
  repeatMonths: z.coerce.number().int().min(1).max(36).optional(),
  replaceExistingSeries: z.coerce.boolean().optional()
});

const updateSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1).optional(),
  month: monthSchema.optional(),
  amount: amountSchema.optional(),
  currency: currencySchema.optional()
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.spendingExpectation.findMany({
    where: { userId: auth.userId },
    include: { card: true },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const card = await prisma.card.findFirst({
    where: { id: parsed.data.cardId, userId: auth.userId },
    select: { id: true }
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const repeatMonths = parsed.data.repeatMonths ?? appEnv.expectationRepeatMonthsDefault;
  const seriesKey = `${parsed.data.cardId}:${parsed.data.month}`;
  const months = Array.from({ length: repeatMonths }, (_, idx) => addMonths(parsed.data.month, idx));

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      months.map((month) =>
        tx.spendingExpectation.upsert({
          where: {
            cardId_month: {
              cardId: parsed.data.cardId,
              month
            }
          },
          create: {
            cardId: parsed.data.cardId,
            month,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            seriesKey,
            userId: auth.userId
          },
          update: {
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            seriesKey,
            userId: auth.userId
          }
        })
      )
    );

    const replaceExistingSeries =
      parsed.data.replaceExistingSeries ?? appEnv.expectationReplaceExistingSeriesDefault;

    if (replaceExistingSeries) {
      await tx.spendingExpectation.deleteMany({
        where: {
          userId: auth.userId,
          cardId: parsed.data.cardId,
          seriesKey,
          month: { notIn: months }
        }
      });
    }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  if (changes.cardId) {
    const card = await prisma.card.findFirst({
      where: { id: changes.cardId, userId: auth.userId },
      select: { id: true }
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
  }

  const update = await prisma.spendingExpectation.updateMany({
    where: { id, userId: auth.userId },
    data: changes
  });
  if (update.count === 0) {
    return NextResponse.json({ error: "Expectation not found" }, { status: 404 });
  }

  const row = await prisma.spendingExpectation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Expectation not found" }, { status: 404 });
  }

  return NextResponse.json({ ...row, amount: Number(row.amount) });
}

export async function DELETE(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.spendingExpectation.deleteMany({ where: { id: parsed.data.id, userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
