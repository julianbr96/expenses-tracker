import { prisma } from "@/lib/db";
import { amountSchema, currencySchema, monthSchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
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

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.advancement.findMany({
    where: { userId: auth.userId },
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

  const row = await prisma.advancement.create({
    data: {
      ...parsed.data,
      note: parsed.data.note || null,
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
  const update = await prisma.advancement.updateMany({
    where: { id, userId: auth.userId },
    data: {
      ...changes,
      note: changes.note === undefined ? undefined : changes.note || null
    }
  });
  if (update.count === 0) {
    return NextResponse.json({ error: "Advancement not found" }, { status: 404 });
  }
  const row = await prisma.advancement.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Advancement not found" }, { status: 404 });
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

  await prisma.advancement.deleteMany({ where: { id: parsed.data.id, userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
