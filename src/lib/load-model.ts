import { prisma } from "@/lib/db";
import { decimalToNumber, toDateOnly } from "@/lib/api";

export async function loadModelForProjection(userId?: string) {
  const userScoped = userId ? { userId } : {};
  const [cards, expenses, incomes, fixedExpenses, expectations, exchangeRates, monthlyAdjustments, advancements] = await Promise.all([
    prisma.card.findMany({ where: userScoped, orderBy: { createdAt: "asc" } }),
    prisma.expense.findMany({
      where: userId ? { card: { userId } } : undefined,
      orderBy: { date: "asc" }
    }),
    prisma.incomeSource.findMany({ where: userScoped, orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.fixedExpense.findMany({ where: userScoped, orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.spendingExpectation.findMany({ where: userScoped, orderBy: [{ month: "asc" }, { createdAt: "asc" }] }),
    prisma.exchangeRate.findMany({ orderBy: { date: "asc" } }),
    prisma.monthlyAdjustment.findMany({ where: userScoped, orderBy: { month: "asc" } }),
    prisma.advancement.findMany({ where: userScoped, orderBy: [{ month: "asc" }, { createdAt: "asc" }] })
  ]);

  return {
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      sourceType: card.sourceType,
      isActive: card.isActive
    })),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      date: expense.date.toISOString(),
      cardId: expense.cardId,
      amount: decimalToNumber(expense.amount),
      currency: expense.currency
    })),
    incomes: incomes.map((income) => ({
      id: income.id,
      amount: decimalToNumber(income.amount),
      currency: income.currency,
      startMonth: income.startMonth,
      endMonth: income.endMonth,
      isActive: income.isActive
    })),
    fixedExpenses: fixedExpenses.map((fixed) => ({
      id: fixed.id,
      amount: decimalToNumber(fixed.amount),
      currency: fixed.currency,
      startMonth: fixed.startMonth,
      endMonth: fixed.endMonth,
      isActive: fixed.isActive
    })),
    expectations: expectations.map((expectation) => ({
      id: expectation.id,
      cardId: expectation.cardId,
      month: expectation.month,
      amount: decimalToNumber(expectation.amount),
      currency: expectation.currency
    })),
    exchangeRates: exchangeRates.map((rate) => ({
      date: toDateOnly(rate.date),
      arsPerUsd: decimalToNumber(rate.arsPerUsd)
    })),
    monthlyAdjustments: monthlyAdjustments.map((row) => ({
      month: row.month,
      amount: decimalToNumber(row.amount),
      currency: row.currency
    })),
    advancements: advancements.map((row) => ({
      id: row.id,
      month: row.month,
      amount: decimalToNumber(row.amount),
      currency: row.currency,
      isActive: row.isActive
    }))
  };
}
