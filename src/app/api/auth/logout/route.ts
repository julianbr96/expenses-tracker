import { clearAuthCookies, readCookie, revokeRefreshToken, REFRESH_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const refreshToken = readCookie(request, REFRESH_COOKIE);
  await revokeRefreshToken(refreshToken);

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
