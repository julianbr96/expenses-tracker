import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { appEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

export const ACCESS_COOKIE = "finance_access";
export const REFRESH_COOKIE = "finance_refresh";

type TokenType = "access" | "refresh";

interface TokenPayload {
  sub: string;
  exp: number;
  type: TokenType;
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer.toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function tokenSignature(body: string): string {
  return createHmac("sha256", appEnv.authTokenSecret).update(body).digest("base64url");
}

function signToken(payload: TokenPayload): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = tokenSignature(body);
  return `${body}.${signature}`;
}

function verifyToken(token: string, expectedType: TokenType): TokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = tokenSignature(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
    if (!payload || payload.type !== expectedType) return null;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(storedHash: string | null, candidate: string): boolean {
  if (!storedHash) return false;
  const [algo, salt, hash] = storedHash.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const candidateHash = scryptSync(candidate, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidateHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookieHeader(request: Request): Map<string, string> {
  const raw = request.headers.get("cookie") ?? "";
  const map = new Map<string, string>();
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    map.set(k, decodeURIComponent(rest.join("=")));
  }
  return map;
}

export function readCookie(request: Request, name: string): string | null {
  return parseCookieHeader(request).get(name) ?? null;
}

export function getUserIdFromAccessToken(request: Request): string | null {
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) return null;
  return verifyToken(token, "access")?.sub ?? null;
}

export function authErrorResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function requireUserId(request: Request): { userId: string } | { response: NextResponse } {
  const userId = getUserIdFromAccessToken(request);
  if (!userId) return { response: authErrorResponse() };
  return { userId };
}

export async function issueAuthTokens(userId: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  const accessExp = nowSec + appEnv.authAccessTtlSeconds;
  const refreshExp = nowSec + appEnv.authRefreshTtlSeconds;

  const accessToken = signToken({ sub: userId, exp: accessExp, type: "access" });
  const refreshToken = signToken({ sub: userId, exp: refreshExp, type: "refresh" });

  await prisma.authRefreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(refreshExp * 1000)
    }
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(refreshToken: string) {
  const payload = verifyToken(refreshToken, "refresh");
  if (!payload) return null;

  const tokenHash = hashRefreshToken(refreshToken);
  const row = await prisma.authRefreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    }
  });
  if (!row) return null;

  await prisma.authRefreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() }
  });

  return issueAuthTokens(payload.sub);
}

export async function revokeRefreshToken(refreshToken: string | null) {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.authRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export function setAuthCookies(response: NextResponse, tokens: { accessToken: string; refreshToken: string }) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: appEnv.authAccessTtlSeconds,
    path: "/"
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: appEnv.authRefreshTtlSeconds,
    path: "/"
  });
}

export function clearAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 0,
    path: "/"
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 0,
    path: "/"
  });
}

export async function claimLegacyDataForUser(userId: string) {
  const alreadyClaimed = await prisma.card.count({ where: { userId: { not: null } } });
  if (alreadyClaimed > 0) return;

  await prisma.$transaction([
    prisma.card.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.incomeSource.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.fixedExpense.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.spendingExpectation.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.monthlyAdjustment.updateMany({ where: { userId: null }, data: { userId } }),
    prisma.advancement.updateMany({ where: { userId: null }, data: { userId } })
  ]);
}
