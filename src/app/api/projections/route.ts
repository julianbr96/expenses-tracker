import { generateProjection } from "@/lib/finance";
import { appEnv } from "@/lib/env";
import { loadModelForProjection } from "@/lib/load-model";
import { prisma } from "@/lib/db";
import { ensureDefaultExpenseCategories } from "@/lib/expense-categories-db";
import { requireUserId } from "@/lib/auth";
import { addMonths, monthDiff, toMonthKey } from "@/lib/time";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = requireUserId(request);
  if ("response" in auth) return auth.response;

  await ensureDefaultExpenseCategories(auth.userId);

  const model = await loadModelForProjection(auth.userId);
  const currentMonth = toMonthKey(new Date());
  const currentYear = currentMonth.slice(0, 4);
  const currentYearStart = `${currentYear}-01`;
  const currentYearEnd = `${currentYear}-12`;

  const candidateMonths = [
    ...model.expenses.map((row) => row.date.slice(0, 7)),
    ...model.incomes.map((row) => row.startMonth),
    ...model.fixedExpenses.map((row) => row.startMonth),
    ...model.expectations.map((row) => row.month),
    ...(model.monthlyAdjustments ?? []).map((row) => row.month),
    ...(model.advancements ?? []).map((row) => row.month)
  ];

  const earliestDataMonth = candidateMonths.length > 0 ? candidateMonths.reduce((min, month) => (month < min ? month : min)) : currentMonth;
  const latestDataMonth = candidateMonths.length > 0 ? candidateMonths.reduce((max, month) => (month > max ? month : max)) : currentMonth;

  const startMonthCandidate = addMonths(earliestDataMonth, -1);
  const startMonth = startMonthCandidate < currentYearStart ? startMonthCandidate : currentYearStart;

  const endMonthCandidate = addMonths(latestDataMonth, 1);
  const endMonth = endMonthCandidate > currentYearEnd ? endMonthCandidate : currentYearEnd;
  const totalMonths = Math.max(1, monthDiff(startMonth, endMonth) + 1);

  const projection = generateProjection({
    ...model,
    startMonth,
    monthsAhead: totalMonths,
    startFromCurrentMonth: false
  });

  const [currentUser, cards, categories, expenses, incomes, fixedExpenses, expectations, exchangeRates, monthlyAdjustments, advancements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, username: true }
    }),
    prisma.card.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "asc" } }),
    prisma.expenseCategory.findMany({
      where: { userId: auth.userId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }, { createdAt: "asc" }]
    }),
    prisma.expense.findMany({
      where: { card: { userId: auth.userId } },
      include: { card: true, category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    }),
    prisma.incomeSource.findMany({ where: { userId: auth.userId }, orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.fixedExpense.findMany({ where: { userId: auth.userId }, orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.spendingExpectation.findMany({
      where: { userId: auth.userId },
      include: { card: true },
      orderBy: [{ month: "asc" }, { createdAt: "asc" }]
    }),
    prisma.userExchangeRate.findMany({
      where: { userId: auth.userId },
      orderBy: [{ createdAt: "desc" }, { date: "desc" }]
    }),
    prisma.monthlyAdjustment.findMany({ where: { userId: auth.userId }, orderBy: { month: "asc" } }),
    prisma.advancement.findMany({ where: { userId: auth.userId }, orderBy: [{ month: "asc" }, { createdAt: "asc" }] })
  ]);

  const latestRatesByMonth = new Map<string, (typeof exchangeRates)[number]>();
  for (const row of exchangeRates) {
    const month = row.date.toISOString().slice(0, 7);
    if (!latestRatesByMonth.has(month)) {
      latestRatesByMonth.set(month, row);
    }
  }
  const monthlyExchangeRates = [...latestRatesByMonth.values()]
    .sort((a, b) => b.date.toISOString().slice(0, 10).localeCompare(a.date.toISOString().slice(0, 10)))
    .slice(0, appEnv.exchangeRatesHistoryLimit);

  return NextResponse.json({
    currentUser,
    projection,
    cards,
    categories,
    expenses: expenses.map((row) => ({
      ...row,
      amount: Number(row.amount),
      date: row.date.toISOString()
    })),
    incomes: incomes.map((row) => ({ ...row, amount: Number(row.amount) })),
    fixedExpenses: fixedExpenses.map((row) => ({ ...row, amount: Number(row.amount) })),
    expectations: expectations.map((row) => ({ ...row, amount: Number(row.amount) })),
    monthlyAdjustments: monthlyAdjustments.map((row) => ({ ...row, amount: Number(row.amount) })),
    advancements: advancements.map((row) => ({ ...row, amount: Number(row.amount) })),
    exchangeRates: monthlyExchangeRates.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
      createdAt: row.createdAt.toISOString(),
      arsPerUsd: Number(row.arsPerUsd)
    }))
  });
}
