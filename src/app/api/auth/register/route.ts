import { prisma } from "@/lib/db";
import { claimLegacyDataForUser, hashPassword, issueAuthTokens, setAuthCookies } from "@/lib/auth";
import { ensureDefaultExpenseCategories } from "@/lib/expense-categories-db";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(parsed.data.password)
    }
  });

  await claimLegacyDataForUser(user.id);
  await ensureDefaultExpenseCategories(user.id);
  const tokens = await issueAuthTokens(user.id);

  const response = NextResponse.json({ ok: true, user: { id: user.id, username: user.username } }, { status: 201 });
  setAuthCookies(response, tokens);
  return response;
}
