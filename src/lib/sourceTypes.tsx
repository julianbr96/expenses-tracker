import type { ReactNode } from "react";

export type SourceType = "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT" | "PREPAID" | "CASH" | "OTHER";

type SourceTypeMeta = {
  label: string;
  short: string;
  emoji: string;
};

const DEFAULT_SOURCE_TYPE: SourceType = "CREDIT_CARD";

export const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType } & SourceTypeMeta> = [
  { value: "CREDIT_CARD", label: "Credit Card", short: "Credit", emoji: "💳" },
  { value: "DEBIT_CARD", label: "Debit Card", short: "Debit", emoji: "🏧" },
  { value: "BANK_ACCOUNT", label: "Bank Account", short: "Bank", emoji: "🏦" },
  { value: "PREPAID", label: "Prepaid", short: "Prepaid", emoji: "🧾" },
  { value: "CASH", label: "Cash", short: "Cash", emoji: "💵" },
  { value: "OTHER", label: "Other", short: "Other", emoji: "◌" }
];

export function sourceTypeMeta(value: SourceType | string | null | undefined) {
  if (!value) return SOURCE_TYPE_OPTIONS[0];
  return SOURCE_TYPE_OPTIONS.find((option) => option.value === value) ?? SOURCE_TYPE_OPTIONS[SOURCE_TYPE_OPTIONS.length - 1];
}

export function sourceTypeLabel(value: SourceType | string | null | undefined): string {
  return sourceTypeMeta(value).label;
}

export function sourceTypeSelectLabel(
  value: SourceType | string | null | undefined,
  name: string,
  mode: "emoji" | "text" = "emoji"
): string {
  const meta = sourceTypeMeta(value);
  if (mode === "emoji") return `${meta.emoji} ${name}`;
  return name;
}

export function SourceTypeGlyph({
  sourceType,
  className
}: {
  sourceType: SourceType | string | null | undefined;
  className?: string;
}): ReactNode {
  const safeType = (sourceTypeMeta(sourceType).value ?? DEFAULT_SOURCE_TYPE) as SourceType;
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden>
      {safeType === "CREDIT_CARD" ? (
        <>
          <rect x="1.5" y="3" width="13" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <line x1="1.5" y1="6.1" x2="14.5" y2="6.1" stroke="currentColor" strokeWidth="1.3" />
        </>
      ) : null}
      {safeType === "DEBIT_CARD" ? (
        <>
          <rect x="1.5" y="3" width="13" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="5.5" cy="8.2" r="1.3" fill="currentColor" />
          <circle cx="8" cy="8.2" r="1.3" fill="currentColor" opacity="0.7" />
        </>
      ) : null}
      {safeType === "BANK_ACCOUNT" ? (
        <>
          <polygon points="8,2.2 14.2,5 1.8,5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <line x1="3.2" y1="5.4" x2="3.2" y2="11.6" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="5.4" x2="8" y2="11.6" stroke="currentColor" strokeWidth="1.2" />
          <line x1="12.8" y1="5.4" x2="12.8" y2="11.6" stroke="currentColor" strokeWidth="1.2" />
          <line x1="2.2" y1="12.5" x2="13.8" y2="12.5" stroke="currentColor" strokeWidth="1.3" />
        </>
      ) : null}
      {safeType === "PREPAID" ? (
        <>
          <rect x="2.2" y="2.8" width="11.6" height="10.4" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <line x1="5.1" y1="5.6" x2="10.9" y2="10.4" stroke="currentColor" strokeWidth="1.3" />
          <line x1="10.9" y1="5.6" x2="5.1" y2="10.4" stroke="currentColor" strokeWidth="1.3" />
        </>
      ) : null}
      {safeType === "CASH" ? (
        <>
          <rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.8" ry="1.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeType === "OTHER" ? (
        <>
          <circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
          <circle cx="8" cy="8" r="0.9" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}
