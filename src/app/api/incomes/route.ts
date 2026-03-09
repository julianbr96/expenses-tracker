import { prisma } from "@/lib/db";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
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

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.incomeSource.findMany({
    where: { userId: auth.userId },
    orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }]
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

  const row = await prisma.incomeSource.create({
    data: {
      ...parsed.data,
      endMonth: parsed.data.endMonth || null,
      userId: auth.userId
    }
  });

  return NextResponse.json({ ...row, amount: Number(row.amount) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const update = await prisma.incomeSource.updateMany({
    where: { id, userId: auth.userId },
    data: {
      ...changes,
      endMonth: changes.endMonth === undefined ? undefined : changes.endMonth || null
    }
  });
  if (update.count === 0) {
    return NextResponse.json({ error: "Income source not found" }, { status: 404 });
  }

  const row = await prisma.incomeSource.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Income source not found" }, { status: 404 });
  }

  return NextResponse.json({ ...row, amount: Number(row.amount) });
}
