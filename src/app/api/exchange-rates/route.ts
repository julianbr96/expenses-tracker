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

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const rows = await prisma.exchangeRate.findMany({
    orderBy: { date: "desc" },
    take: appEnv.exchangeRatesHistoryLimit
  });
  return NextResponse.json(
    rows.map((row) => ({
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
  const row = await prisma.exchangeRate.upsert({
    where: { date },
    create: {
      date,
      arsPerUsd: parsed.data.arsPerUsd,
      source: parsed.data.source || null
    },
    update: {
      arsPerUsd: parsed.data.arsPerUsd,
      source: parsed.data.source || null
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
