import { prisma } from "@/lib/db";
import { currencySchema, monthSchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
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

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.monthlyAdjustment.findMany({
    where: { userId: auth.userId },
    orderBy: { month: "asc" }
  });

  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function PUT(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.monthlyAdjustment.upsert({
    where: {
      userId_month: {
        userId: auth.userId,
        month: parsed.data.month
      }
    },
    create: {
      month: parsed.data.month,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      note: parsed.data.note || null,
      userId: auth.userId
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
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.monthlyAdjustment.deleteMany({ where: { month: parsed.data.month, userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
