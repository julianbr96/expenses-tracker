import { addMonths, compareMonth, isMonthInRange, toMonthKey } from "@/lib/time";
import { appEnv } from "@/lib/env";
import type { Currency, ProjectionRow } from "@/lib/types";

interface CardRecord {
  id: string;
  name: string;
  isActive: boolean;
}

interface ExpenseRecord {
  id: string;
  date: string;
  cardId: string;
  amount: number;
  currency: Currency;
}

interface IncomeRecord {
  id: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface FixedExpenseRecord {
  id: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface ExpectationRecord {
  id: string;
  cardId: string;
  month: string;
  amount: number;
  currency: Currency;
}

interface ExchangeRateRecord {
  date: string;
  arsPerUsd: number;
}

interface MonthlyAdjustmentRecord {
  month: string;
  amount: number;
  currency: Currency;
}

interface AdvancementRecord {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  isActive: boolean;
}

export interface ProjectionInput {
  cards: CardRecord[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  fixedExpenses: FixedExpenseRecord[];
  expectations: ExpectationRecord[];
  exchangeRates: ExchangeRateRecord[];
  monthlyAdjustments?: MonthlyAdjustmentRecord[];
  advancements?: AdvancementRecord[];
  startMonth?: string;
  monthsAhead?: number;
  startFromCurrentMonth?: boolean;
}

interface CardTrackerRow {
  cardId: string;
  cardName: string;
  currentCycleUsd: number;
  expectedCycleUsd: number;
  remainingExpectedUsd: number;
  currentCycleArs: number;
  expectedCycleArs: number;
  remainingExpectedArs: number;
  lastExpenseDate: string | null;
}

export interface ProjectionOutput {
  currentMonth: string;
  rows: ProjectionRow[];
  cardTracker: CardTrackerRow[];
  dashboard: {
    incomeUsd: number;
    expectedExpensesUsd: number;
    projectedSavingsUsd: number;
    nextCardPaymentUsd: number;
    nextCardPaymentArs: number;
  };
  paymentMonth: string;
  currentRateArsPerUsd: number;
  startMonth: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeRateDate(dateLike: string): string {
  return dateLike.slice(0, 10);
}

function buildRateLookup(exchangeRates: ExchangeRateRecord[]) {
  const sorted = [...exchangeRates]
    .map((rate) => ({ date: normalizeRateDate(rate.date), arsPerUsd: rate.arsPerUsd }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    sorted,
    getRate(dateLike: string): number {
      const date = normalizeRateDate(dateLike);
      let found: number | null = null;
      for (const item of sorted) {
        if (item.date <= date) {
          found = item.arsPerUsd;
          continue;
        }
        break;
      }
      return found ?? appEnv.defaultArsPerUsd;
    }
  };
}

function toUsd(amount: number, currency: Currency, dateLike: string, rateLookup: ReturnType<typeof buildRateLookup>): number {
  if (currency === "USD") return amount;
  const rate = rateLookup.getRate(dateLike);
  return amount / rate;
}

function sumByMonthAndCard(
  expenses: ExpenseRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): Map<string, Map<string, number>> {
  const monthCardTotals = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    const month = toMonthKey(new Date(expense.date));
    const usd = toUsd(expense.amount, expense.currency, expense.date, rateLookup);

    if (!monthCardTotals.has(month)) monthCardTotals.set(month, new Map());
    const cardMap = monthCardTotals.get(month)!;
    cardMap.set(expense.cardId, (cardMap.get(expense.cardId) ?? 0) + usd);
  }

  return monthCardTotals;
}

function sumExpectationsByMonthAndCard(
  expectations: ExpectationRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): Map<string, Map<string, number>> {
  const monthCardTotals = new Map<string, Map<string, number>>();

  for (const expectation of expectations) {
    const dateLike = `${expectation.month}-01`;
    const usd = toUsd(expectation.amount, expectation.currency, dateLike, rateLookup);

    if (!monthCardTotals.has(expectation.month)) monthCardTotals.set(expectation.month, new Map());
    const cardMap = monthCardTotals.get(expectation.month)!;
    cardMap.set(expectation.cardId, (cardMap.get(expectation.cardId) ?? 0) + usd);
  }

  return monthCardTotals;
}

function totalMonthCard(map: Map<string, Map<string, number>>, month: string): number {
  return [...(map.get(month)?.values() ?? [])].reduce((acc, curr) => acc + curr, 0);
}

function sumAdjustmentsByMonth(
  adjustments: MonthlyAdjustmentRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const adjustment of adjustments) {
    const dateLike = `${adjustment.month}-01`;
    const usd = toUsd(adjustment.amount, adjustment.currency, dateLike, rateLookup);
    totals.set(adjustment.month, (totals.get(adjustment.month) ?? 0) + usd);
  }
  return totals;
}

function sumAdvancementRepaymentsByMonth(
  advancements: AdvancementRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const advancement of advancements) {
    if (!advancement.isActive) continue;
    const repaymentMonth = addMonths(advancement.month, 1);
    const dateLike = `${repaymentMonth}-01`;
    const usd = toUsd(advancement.amount, advancement.currency, dateLike, rateLookup);
    totals.set(repaymentMonth, (totals.get(repaymentMonth) ?? 0) + usd);
  }
  return totals;
}

function cardPaymentUsdForMonth(
  paymentMonth: string,
  currentMonth: string,
  actualByMonthCard: Map<string, Map<string, number>>,
  expectedByMonthCard: Map<string, Map<string, number>>
): number {
  const spendingMonth = addMonths(paymentMonth, -1);
  const nextMonth = addMonths(currentMonth, 1);
  const actual = totalMonthCard(actualByMonthCard, spendingMonth);
  const expectedPayment = totalMonthCard(expectedByMonthCard, paymentMonth);

  if (compareMonth(paymentMonth, currentMonth) <= 0) {
    return actual;
  }

  if (paymentMonth === nextMonth) {
    return actual + Math.max(expectedPayment - actual, 0);
  }

  return expectedPayment;
}

function monthIncomeUsd(
  month: string,
  incomes: IncomeRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): number {
  const dateLike = `${month}-01`;
  return incomes
    .filter((income) => income.isActive)
    .filter((income) => isMonthInRange(month, income.startMonth, income.endMonth))
    .reduce((acc, income) => acc + toUsd(income.amount, income.currency, dateLike, rateLookup), 0);
}

function monthFixedUsd(
  month: string,
  fixedExpenses: FixedExpenseRecord[],
  rateLookup: ReturnType<typeof buildRateLookup>
): number {
  const dateLike = `${month}-01`;
  return fixedExpenses
    .filter((fixed) => fixed.isActive)
    .filter((fixed) => isMonthInRange(month, fixed.startMonth, fixed.endMonth))
    .reduce((acc, fixed) => acc + toUsd(fixed.amount, fixed.currency, dateLike, rateLookup), 0);
}

export function generateProjection(input: ProjectionInput): ProjectionOutput {
  const now = new Date();
  const currentMonth = toMonthKey(now);
  const monthsAhead = input.monthsAhead ?? appEnv.projectionMonthsAhead;

  const rateLookup = buildRateLookup(input.exchangeRates);
  const actualByMonthCard = sumByMonthAndCard(input.expenses, rateLookup);
  const expectedByMonthCard = sumExpectationsByMonthAndCard(input.expectations, rateLookup);
  const adjustmentsByMonth = sumAdjustmentsByMonth(input.monthlyAdjustments ?? [], rateLookup);
  const advancementRepaymentsByMonth = sumAdvancementRepaymentsByMonth(input.advancements ?? [], rateLookup);

  const defaultStartMonth = input.startFromCurrentMonth === false ? addMonths(currentMonth, -2) : currentMonth;
  const firstMonth = input.startMonth ?? defaultStartMonth;

  const rows: ProjectionRow[] = [];
  let savings = 0;

  for (let i = 0; i < monthsAhead; i += 1) {
    const month = addMonths(firstMonth, i);
    const incomeUsd = monthIncomeUsd(month, input.incomes, rateLookup);
    const fixedExpensesUsd = monthFixedUsd(month, input.fixedExpenses, rateLookup);
    const cardPaymentUsd = cardPaymentUsdForMonth(month, currentMonth, actualByMonthCard, expectedByMonthCard);
    const advancementRepaymentUsd = advancementRepaymentsByMonth.get(month) ?? 0;
    const manualAdjustmentUsd = adjustmentsByMonth.get(month) ?? 0;

    const totalExpensesUsd = fixedExpensesUsd + cardPaymentUsd + advancementRepaymentUsd;
    const netUsd = incomeUsd - totalExpensesUsd + manualAdjustmentUsd;
    savings += netUsd;

    rows.push({
      month,
      incomeUsd: round2(incomeUsd),
      fixedExpensesUsd: round2(fixedExpensesUsd),
      cardPaymentUsd: round2(cardPaymentUsd),
      advancementRepaymentUsd: round2(advancementRepaymentUsd),
      manualAdjustmentUsd: round2(manualAdjustmentUsd),
      totalExpensesUsd: round2(totalExpensesUsd),
      netUsd: round2(netUsd),
      cumulativeSavingsUsd: round2(savings)
    });
  }

  const paymentMonth = addMonths(currentMonth, 1);
  const today = new Date().toISOString().slice(0, 10);
  const currentRateArsPerUsd = rateLookup.getRate(today);

  const cardTracker: CardTrackerRow[] = input.cards.map((card) => {
    const actual = actualByMonthCard.get(currentMonth)?.get(card.id) ?? 0;
    const expected = expectedByMonthCard.get(paymentMonth)?.get(card.id) ?? 0;

    const lastExpense = [...input.expenses]
      .filter((expense) => expense.cardId === card.id)
      .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

    return {
      cardId: card.id,
      cardName: card.name,
      currentCycleUsd: round2(actual),
      expectedCycleUsd: round2(expected),
      remainingExpectedUsd: round2(Math.max(expected - actual, 0)),
      currentCycleArs: round2(actual * currentRateArsPerUsd),
      expectedCycleArs: round2(expected * currentRateArsPerUsd),
      remainingExpectedArs: round2(Math.max(expected - actual, 0) * currentRateArsPerUsd),
      lastExpenseDate: lastExpense ? normalizeRateDate(lastExpense.date) : null
    };
  });

  const dashboardCurrent = rows.find((row) => row.month === currentMonth);
  const nextMonth = addMonths(currentMonth, 1);
  const nextMonthRow = rows.find((row) => row.month === nextMonth);

  return {
    currentMonth,
    rows,
    cardTracker,
    dashboard: {
      incomeUsd: dashboardCurrent?.incomeUsd ?? 0,
      expectedExpensesUsd: dashboardCurrent?.totalExpensesUsd ?? 0,
      projectedSavingsUsd: dashboardCurrent?.netUsd ?? 0,
      nextCardPaymentUsd: nextMonthRow?.cardPaymentUsd ?? 0,
      nextCardPaymentArs: round2((nextMonthRow?.cardPaymentUsd ?? 0) * currentRateArsPerUsd)
    },
    paymentMonth,
    currentRateArsPerUsd,
    startMonth: firstMonth
  };
}
