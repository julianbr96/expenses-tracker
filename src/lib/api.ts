import { Currency } from "@prisma/client";
import { z } from "zod";

export const currencySchema = z.nativeEnum(Currency);
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const amountSchema = z.coerce.number().finite().positive();

export function decimalToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
