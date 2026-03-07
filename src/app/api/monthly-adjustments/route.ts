import { prisma } from "@/lib/db";
import { currencySchema, monthSchema } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";

const signedAmountSchema = z.coerce.number().finite();

const upsertSchema = z.object({
  month: monthSchema,
  amount: signedAmountSchema,
  currency: currencySchema.optional().default("USD"),
  note: z.string().max(200).optional().nullable()
});

const deleteSchema = z.object({
  month: monthSchema
});

export async function GET() {
  const rows = await prisma.monthlyAdjustment.findMany({
    orderBy: { month: "asc" }
  });

  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function PUT(request: Request) {
  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.monthlyAdjustment.upsert({
    where: { month: parsed.data.month },
    create: {
      month: parsed.data.month,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note || null
    },
    update: {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note || null
    }
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.monthlyAdjustment.deleteMany({ where: { month: parsed.data.month } });
  return NextResponse.json({ ok: true });
}
