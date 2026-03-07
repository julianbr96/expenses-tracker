function readPositiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

export const appEnv = {
  defaultArsPerUsd: readPositiveNumber("DEFAULT_ARS_PER_USD", 1100),
  projectionMonthsAhead: readPositiveInt("PROJECTION_MONTHS_AHEAD", 24),
  exchangeRatesHistoryLimit: readPositiveInt("EXCHANGE_RATE_HISTORY_LIMIT", 90),
  expectationRepeatMonthsDefault: clampInt(
    readPositiveInt("EXPECTATION_REPEAT_MONTHS_DEFAULT", 1),
    1,
    36
  ),
  expectationReplaceExistingSeriesDefault: readBoolean(
    "EXPECTATION_REPLACE_EXISTING_SERIES_DEFAULT",
    true
  )
};
