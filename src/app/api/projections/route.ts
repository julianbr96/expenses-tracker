import { generateProjection } from "@/lib/finance";
import { appEnv } from "@/lib/env";
import { loadModelForProjection } from "@/lib/load-model";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const model = await loadModelForProjection();
  const projection = generateProjection({
    ...model,
    monthsAhead: appEnv.projectionMonthsAhead,
    startFromCurrentMonth: true
  });

  const [cards, expenses, incomes, fixedExpenses, expectations, exchangeRates, monthlyAdjustments, advancements] = await Promise.all([
    prisma.card.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.expense.findMany({ include: { card: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.incomeSource.findMany({ orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.fixedExpense.findMany({ orderBy: [{ startMonth: "asc" }, { createdAt: "asc" }] }),
    prisma.spendingExpectation.findMany({ include: { card: true }, orderBy: [{ month: "asc" }, { createdAt: "asc" }] }),
    prisma.exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: appEnv.exchangeRatesHistoryLimit
    }),
    prisma.monthlyAdjustment.findMany({ orderBy: { month: "asc" } }),
    prisma.advancement.findMany({ orderBy: [{ month: "asc" }, { createdAt: "asc" }] })
  ]);

  return NextResponse.json({
    projection,
    cards,
    expenses: expenses.map((row) => ({
      ...row,
      amount: Number(row.amount),
      date: row.date.toISOString().slice(0, 10)
    })),
    incomes: incomes.map((row) => ({ ...row, amount: Number(row.amount) })),
    fixedExpenses: fixedExpenses.map((row) => ({ ...row, amount: Number(row.amount) })),
    expectations: expectations.map((row) => ({ ...row, amount: Number(row.amount) })),
    monthlyAdjustments: monthlyAdjustments.map((row) => ({ ...row, amount: Number(row.amount) })),
    advancements: advancements.map((row) => ({ ...row, amount: Number(row.amount) })),
    exchangeRates: exchangeRates.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
      arsPerUsd: Number(row.arsPerUsd)
    }))
  });
}
