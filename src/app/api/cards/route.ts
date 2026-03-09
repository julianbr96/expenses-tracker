import { prisma } from "@/lib/db";
import { currencySchema, sourceTypeSchema } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  currency: currencySchema,
  sourceType: sourceTypeSchema.default("CREDIT_CARD")
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  currency: currencySchema.optional(),
  sourceType: sourceTypeSchema.optional(),
  isActive: z.boolean().optional()
});

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const cards = await prisma.card.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const card = await prisma.card.create({ data: { ...parsed.data, userId: auth.userId } });
  return NextResponse.json(card, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const update = await prisma.card.updateMany({
    where: { id, userId: auth.userId },
    data: changes
  });
  if (update.count === 0) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const card = await prisma.card.findUnique({ where: { id } });

  return NextResponse.json(card);
}
