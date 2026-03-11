import { prisma } from "@/lib/db";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export async function ensureDefaultExpenseCategories(userId: string) {
  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
      userId,
      key: category.key,
      name: category.name,
      emoji: category.emoji,
      iconKey: category.iconKey,
      isDefault: true,
      isActive: true
    })),
    skipDuplicates: true
  });
}
