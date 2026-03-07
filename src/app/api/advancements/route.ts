import { prisma } from "@/lib/db";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  month: monthSchema,
  amount: amountSchema,
  currency: currencySchema,
  note: z.string().max(200).optional().nullable()
});

const updateSchema = z.object({
  id: z.string().min(1),
  month: monthSchema.optional(),
  amount: amountSchema.optional(),
  currency: currencySchema.optional(),
  note: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional()
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const rows = await prisma.advancement.findMany({
    orderBy: [{ month: "asc" }, { createdAt: "asc" }]
  });
  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.advancement.create({
    data: {
      ...parsed.data,
      note: parsed.data.note || null
    }
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const row = await prisma.advancement.update({
    where: { id },
    data: {
      ...changes,
      note: changes.note === undefined ? undefined : changes.note || null
    }
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) });
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.advancement.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
