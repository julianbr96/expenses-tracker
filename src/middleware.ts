import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) return NextResponse.next();
  if (path === "/api/auth/verify") return NextResponse.next();

  const auth = request.cookies.get("finance_auth")?.value;
  if (auth === "1") return NextResponse.next();

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"]
};
