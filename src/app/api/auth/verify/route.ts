import { prisma } from "@/lib/db";
import {
  claimLegacyDataForUser,
  hashPassword,
  issueAuthTokens,
  setAuthCookies,
  verifyPassword
} from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const password = parsed.data.password;
  const masterPassword = process.env.APP_PASSWORD ?? "";
  const usingMaster = masterPassword.length > 0 && password === masterPassword;

  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    if (!usingMaster) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password)
      }
    });
  } else if (!usingMaster && !verifyPassword(user.passwordHash, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  await claimLegacyDataForUser(user.id);
  const tokens = await issueAuthTokens(user.id);

  const response = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } });
  setAuthCookies(response, tokens);
  return response;
}
