export type Currency = "USD" | "ARS";

export interface ProjectionRow {
  month: string;
  incomeUsd: number;
  fixedExpensesUsd: number;
  cardPaymentUsd: number;
  advancementRepaymentUsd: number;
  manualAdjustmentUsd: number;
  totalExpensesUsd: number;
  netUsd: number;
  cumulativeSavingsUsd: number;
}
