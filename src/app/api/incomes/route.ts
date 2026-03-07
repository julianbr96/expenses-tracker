import { prisma } from "@/lib/db";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  amount: amountSchema,
  currency: currencySchema,
  startMonth: monthSchema,
  endMonth: monthSchema.optional().nullable()
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  amount: amountSchema.optional(),
  currency: currencySchema.optional(),
  startMonth: monthSchema.optional(),
  endMonth: monthSchema.optional().nullable(),
  isActive: z.boolean().optional()
});

export async function GET() {
  const rows = await prisma.incomeSource.findMany({
    orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.incomeSource.create({
    data: {
      ...parsed.data,
      endMonth: parsed.data.endMonth || null
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
  const row = await prisma.incomeSource.update({
    where: { id },
    data: {
      ...changes,
      endMonth: changes.endMonth === undefined ? undefined : changes.endMonth || null
    }
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) });
}
