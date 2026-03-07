export function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthToDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function addMonths(month: string, delta: number): string {
  const date = monthToDate(month);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return toMonthKey(date);
}

export function compareMonth(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isMonthInRange(month: string, startMonth: string, endMonth?: string | null): boolean {
  if (compareMonth(month, startMonth) < 0) return false;
  if (endMonth && compareMonth(month, endMonth) > 0) return false;
  return true;
}
