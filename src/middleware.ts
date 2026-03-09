import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) return NextResponse.next();
  if (path === "/api/auth/verify") return NextResponse.next();
  if (path === "/api/auth/register") return NextResponse.next();
  if (path === "/api/auth/refresh") return NextResponse.next();
  if (path === "/api/auth/logout") return NextResponse.next();
  if (path === "/api/telegram/webhook") return NextResponse.next();

  const auth = request.cookies.get("finance_access")?.value;
  if (auth) return NextResponse.next();

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"]
};
