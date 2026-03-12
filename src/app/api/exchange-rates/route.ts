import { prisma } from "@/lib/db";
import { amountSchema } from "@/lib/api";
import { appEnv } from "@/lib/env";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const upsertSchema = z.object({
  date: z.string().date(),
  arsPerUsd: amountSchema,
  source: z.string().max(100).optional().nullable()
});
const patchSchema = upsertSchema.extend({
  id: z.string().min(1)
});

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.userExchangeRate.findMany({
    where: { userId: auth.userId },
    orderBy: [{ createdAt: "desc" }, { date: "desc" }]
  });

  const latestByMonth = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const month = row.date.toISOString().slice(0, 7);
    if (!latestByMonth.has(month)) {
      latestByMonth.set(month, row);
    }
  }

  const monthlyRows = [...latestByMonth.values()]
    .sort((a, b) => b.date.toISOString().slice(0, 10).localeCompare(a.date.toISOString().slice(0, 10)))
    .slice(0, appEnv.exchangeRatesHistoryLimit);

  return NextResponse.json(
    monthlyRows.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
      arsPerUsd: Number(row.arsPerUsd)
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const row = await prisma.userExchangeRate.create({
    data: {
      date,
      arsPerUsd: parsed.data.arsPerUsd,
      source: parsed.data.source || null,
      userId: auth.userId
    }
  });

  return NextResponse.json(
    {
      ...row,
      date: row.date.toISOString().slice(0, 10),
      arsPerUsd: Number(row.arsPerUsd)
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.userExchangeRate.findFirst({
    where: { id: parsed.data.id, userId: auth.userId },
    select: { id: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Exchange rate not found." }, { status: 404 });
  }

  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const row = await prisma.userExchangeRate.update({
    where: { id: parsed.data.id },
    data: {
      date,
      arsPerUsd: parsed.data.arsPerUsd,
      source: parsed.data.source || null
    }
  });

  return NextResponse.json({
    ...row,
    date: row.date.toISOString().slice(0, 10),
    arsPerUsd: Number(row.arsPerUsd)
  });
}
