import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

interface LegacyExternalRateResponse {
  arsPerUsd?: number;
  rate?: number;
  buy?: number;
  sell?: number;
  date?: string;
}

function readPathNumber(payload: JsonObject, ...path: string[]): number | null {
  let current: unknown = payload;
  for (const segment of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as JsonObject)[segment];
  }
  if (typeof current === "number" && Number.isFinite(current)) return current;
  if (typeof current === "string") {
    const parsed = Number(current);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseExternalRate(payload: JsonObject): number | null {
  // CriptoYa /api/dolar with explicit "cripto" breakdown.
  const criptoDolar =
    readPathNumber(payload, "cripto", "usdc", "ask") ??
    readPathNumber(payload, "cripto", "usdt", "ask") ??
    readPathNumber(payload, "cripto", "ccb", "ask");
  if (typeof criptoDolar === "number" && criptoDolar > 0) return criptoDolar;

  const topLevel =
    readPathNumber(payload, "ask") ??
    readPathNumber(payload, "totalAsk") ??
    readPathNumber(payload, "arsPerUsd") ??
    readPathNumber(payload, "rate") ??
    readPathNumber(payload, "sell") ??
    readPathNumber(payload, "buy");
  if (typeof topLevel === "number") return topLevel;

  // CriptoYa /api/dolar candidates.
  const criptoAsk =
    readPathNumber(payload, "cripto", "ask") ??
    readPathNumber(payload, "cripto", "totalAsk") ??
    readPathNumber(payload, "usdt", "ask") ??
    readPathNumber(payload, "usdt", "totalAsk");
  if (typeof criptoAsk === "number") return criptoAsk;

  // CriptoYa /api/USDT/ARS/1 returns many exchanges at top-level.
  const preferredProviders = ["binance", "buenbit", "ripio", "belo", "lemoncash"];
  for (const provider of preferredProviders) {
    const candidate =
      readPathNumber(payload, provider, "ask") ??
      readPathNumber(payload, provider, "totalAsk");
    if (typeof candidate === "number" && candidate > 0) return candidate;
  }

  const nestedAsks = Object.values(payload)
    .filter((value): value is JsonObject => Boolean(value) && typeof value === "object")
    .map((value) => readPathNumber(value, "ask") ?? readPathNumber(value, "totalAsk"))
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b);
  if (nestedAsks.length > 0) {
    // Use median to reduce outlier impact.
    const mid = Math.floor(nestedAsks.length / 2);
    return nestedAsks[mid];
  }

  const legacy = payload as LegacyExternalRateResponse;
  // Backward compatible candidates for previous provider payloads.
  if (typeof legacy.arsPerUsd === "number") return legacy.arsPerUsd;
  if (typeof legacy.rate === "number") return legacy.rate;
  if (typeof legacy.sell === "number") return legacy.sell;
  if (typeof legacy.buy === "number") return legacy.buy;
  return null;
}

function parsePayloadDate(payload: JsonObject): string {
  const topLevelEpoch = readPathNumber(payload, "time");
  if (typeof topLevelEpoch === "number") {
    return new Date(topLevelEpoch * 1000).toISOString().slice(0, 10);
  }

  const criptoEpoch = readPathNumber(payload, "cripto", "time");
  if (typeof criptoEpoch === "number") {
    return new Date(criptoEpoch * 1000).toISOString().slice(0, 10);
  }

  const firstProviderWithEpoch = Object.values(payload)
    .filter((value): value is JsonObject => Boolean(value) && typeof value === "object")
    .map((value) => readPathNumber(value, "time"))
    .find((value): value is number => typeof value === "number" && value > 0);
  if (typeof firstProviderWithEpoch === "number") {
    return new Date(firstProviderWithEpoch * 1000).toISOString().slice(0, 10);
  }

  const maybeString =
    (typeof payload.date === "string" ? payload.date : null) ??
    (typeof (payload.cripto as JsonObject | undefined)?.time === "string"
      ? ((payload.cripto as JsonObject).time as string)
      : null);
  return (maybeString ?? new Date().toISOString()).slice(0, 10);
}

function resolveProviderConfig() {
  const baseUrl =
    process.env.CRIPTOYA_API_URL ??
    process.env.DOLARITO_API_URL ??
    "https://criptoya.com/api/USDT/ARS/1";
  const apiKey = process.env.CRIPTOYA_API_KEY ?? process.env.DOLARITO_API_KEY ?? "";
  const source = baseUrl.includes("criptoya.com") ? "criptoya" : "external";
  return { baseUrl, apiKey, source };
}

async function syncExternalRate(userId: string) {
  const { baseUrl, apiKey, source } = resolveProviderConfig();

  if (!baseUrl) {
    return NextResponse.json(
      { error: "CRIPTOYA_API_URL is not configured." },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
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

  const payload = (await response.json()) as JsonObject;
  const arsPerUsd = parseExternalRate(payload);

  if (!arsPerUsd) {
    return NextResponse.json(
      { error: "Could not parse ARS/USD from provider payload." },
      { status: 502 }
    );
  }

  const dateKey = parsePayloadDate(payload);
  const date = new Date(`${dateKey}T00:00:00.000Z`);

  const row = await prisma.userExchangeRate.create({
    data: {
      date,
      arsPerUsd,
      source,
      userId
    }
  });

  return NextResponse.json({
    date: row.date.toISOString().slice(0, 10),
    arsPerUsd: Number(row.arsPerUsd)
  });
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;
  return syncExternalRate(auth.userId);
}

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;
  return syncExternalRate(auth.userId);
}
