import { prisma } from "@/lib/db";
import { currencySchema } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  currency: currencySchema
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  currency: currencySchema.optional(),
  isActive: z.boolean().optional()
});

export async function GET() {
  const cards = await prisma.card.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const card = await prisma.card.create({ data: parsed.data });
  return NextResponse.json(card, { status: 201 });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const card = await prisma.card.update({
    where: { id },
    data: changes
  });

  return NextResponse.json(card);
}
