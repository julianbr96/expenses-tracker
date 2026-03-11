import { prisma } from "@/lib/db";
import {
  buildUniqueCategoryKey,
  DEFAULT_CUSTOM_CATEGORY_EMOJI,
  DEFAULT_CUSTOM_CATEGORY_ICON,
  EXPENSE_CATEGORY_ICON_KEYS,
  normalizeCategoryName
} from "@/lib/expense-categories";
import { ensureDefaultExpenseCategories } from "@/lib/expense-categories-db";
import { requireUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(8).optional(),
  iconKey: z.enum(EXPENSE_CATEGORY_ICON_KEYS).optional()
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  iconKey: z.enum(EXPENSE_CATEGORY_ICON_KEYS).optional()
});

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  await ensureDefaultExpenseCategories(auth.userId);

  const rows = await prisma.expenseCategory.findMany({
    where: { userId: auth.userId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }, { createdAt: "asc" }]
  });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await ensureDefaultExpenseCategories(auth.userId);

  const name = normalizeCategoryName(parsed.data.name);
  const existingByName = await prisma.expenseCategory.findFirst({
    where: {
      userId: auth.userId,
      name: { equals: name, mode: "insensitive" },
      isActive: true
    }
  });
  if (existingByName) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }

  const existingKeys = await prisma.expenseCategory.findMany({
    where: { userId: auth.userId },
    select: { key: true }
  });
  const key = buildUniqueCategoryKey(name, existingKeys.map((row) => row.key));

  const row = await prisma.expenseCategory.create({
    data: {
      userId: auth.userId,
      key,
      name,
      emoji: parsed.data.emoji ?? DEFAULT_CUSTOM_CATEGORY_EMOJI,
      iconKey: parsed.data.iconKey ?? DEFAULT_CUSTOM_CATEGORY_ICON,
      isDefault: false
    }
  });

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const existing = await prisma.expenseCategory.findFirst({
    where: { id, userId: auth.userId, isActive: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (existing.isDefault) {
    return NextResponse.json({ error: "Default categories cannot be edited" }, { status: 400 });
  }

  const updateData: {
    name?: string;
    emoji?: string;
    iconKey?: string;
  } = {};

  if (changes.name) {
    const normalizedName = normalizeCategoryName(changes.name);
    const existingByName = await prisma.expenseCategory.findFirst({
      where: {
        userId: auth.userId,
        id: { not: id },
        name: { equals: normalizedName, mode: "insensitive" },
        isActive: true
      }
    });
    if (existingByName) {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
    }
    updateData.name = normalizedName;
  }
  if (changes.emoji) updateData.emoji = changes.emoji;
  if (changes.iconKey) updateData.iconKey = changes.iconKey;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(existing);
  }

  const row = await prisma.expenseCategory.update({
    where: { id },
    data: updateData
  });

  return NextResponse.json(row);
}
