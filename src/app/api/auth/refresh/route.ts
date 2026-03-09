import {
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
  rotateRefreshToken,
  setAuthCookies
} from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const tokens = await rotateRefreshToken(refreshToken);
  if (!tokens) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, tokens);
  return response;
}
