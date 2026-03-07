import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { addMonths } from "@/lib/time";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
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

export async function GET() {
  const rows = await prisma.spendingExpectation.findMany({
    include: { card: true },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
            seriesKey
          },
          update: {
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            seriesKey
          }
        })
      )
    );

    const replaceExistingSeries =
      parsed.data.replaceExistingSeries ?? appEnv.expectationReplaceExistingSeriesDefault;

    if (replaceExistingSeries) {
      await tx.spendingExpectation.deleteMany({
        where: {
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
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const row = await prisma.spendingExpectation.update({
    where: { id },
    data: changes
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.spendingExpectation.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
