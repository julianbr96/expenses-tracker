import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

interface ExternalRateResponse {
  arsPerUsd?: number;
  rate?: number;
  buy?: number;
  sell?: number;
  date?: string;
}

function parseExternalRate(payload: ExternalRateResponse): number | null {
  if (typeof payload.arsPerUsd === "number") return payload.arsPerUsd;
  if (typeof payload.rate === "number") return payload.rate;
  if (typeof payload.sell === "number") return payload.sell;
  if (typeof payload.buy === "number") return payload.buy;
  return null;
}

async function syncExternalRate() {
  const baseUrl = process.env.DOLARITO_API_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "DOLARITO_API_URL is not configured." },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {};
  if (process.env.DOLARITO_API_KEY) {
    headers.Authorization = `Bearer ${process.env.DOLARITO_API_KEY}`;
  }

  const response = await fetch(baseUrl, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch exchange rate: ${response.status}` },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as ExternalRateResponse;
  const arsPerUsd = parseExternalRate(payload);

  if (!arsPerUsd) {
    return NextResponse.json(
      { error: "Could not parse ARS/USD from provider payload." },
      { status: 502 }
    );
  }

  const dateKey = (payload.date ?? new Date().toISOString()).slice(0, 10);
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  const row = await prisma.exchangeRate.upsert({
    where: { date },
    create: {
      date,
      arsPerUsd,
      source: "external"
    },
    update: {
      arsPerUsd,
      source: "external"
    }
  });

  return NextResponse.json({
    date: row.date.toISOString().slice(0, 10),
    arsPerUsd: Number(row.arsPerUsd)
  });
}

export async function POST() {
  return syncExternalRate();
}

export async function GET() {
  return syncExternalRate();
}
