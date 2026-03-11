export const EXPENSE_CATEGORY_ICON_KEYS = [
  "basket",
  "meal",
  "transport",
  "shopping",
  "home",
  "health",
  "fun",
  "service",
  "education",
  "travel",
  "utilities",
  "pet",
  "custom"
] as const;

export type ExpenseCategoryIconKey = (typeof EXPENSE_CATEGORY_ICON_KEYS)[number];

export const EXPENSE_CATEGORY_ICON_OPTIONS: Array<{ value: ExpenseCategoryIconKey; label: string }> = [
  { value: "basket", label: "Basket" },
  { value: "meal", label: "Meal" },
  { value: "transport", label: "Transport" },
  { value: "shopping", label: "Shopping" },
  { value: "home", label: "Home" },
  { value: "health", label: "Health" },
  { value: "fun", label: "Fun" },
  { value: "service", label: "Service" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "utilities", label: "Utilities" },
  { value: "pet", label: "Pet" },
  { value: "custom", label: "Custom" }
];

export const EXPENSE_CATEGORY_EMOJI_OPTIONS = [
  "🛒",
  "🍽️",
  "🚕",
  "🛍️",
  "🏠",
  "💊",
  "🎬",
  "🧾",
  "📚",
  "✈️",
  "💡",
  "🐾",
  "🏷️",
  "🧩"
] as const;

export const DEFAULT_CUSTOM_CATEGORY_EMOJI = "🧩";
export const DEFAULT_CUSTOM_CATEGORY_ICON: ExpenseCategoryIconKey = "custom";

export interface DefaultExpenseCategory {
  key: string;
  name: string;
  emoji: string;
  iconKey: ExpenseCategoryIconKey;
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultExpenseCategory[] = [
  { key: "groceries", name: "Groceries", emoji: "🛒", iconKey: "basket" },
  { key: "dining", name: "Dining", emoji: "🍽️", iconKey: "meal" },
  { key: "transport", name: "Transport", emoji: "🚕", iconKey: "transport" },
  { key: "shopping", name: "Shopping", emoji: "🛍️", iconKey: "shopping" },
  { key: "home", name: "Home", emoji: "🏠", iconKey: "home" },
  { key: "health", name: "Health", emoji: "💊", iconKey: "health" },
  { key: "entertainment", name: "Entertainment", emoji: "🎬", iconKey: "fun" },
  { key: "services", name: "Services", emoji: "🧾", iconKey: "service" },
  { key: "education", name: "Education", emoji: "📚", iconKey: "education" },
  { key: "travel", name: "Travel", emoji: "✈️", iconKey: "travel" },
  { key: "bills", name: "Bills", emoji: "💡", iconKey: "utilities" },
  { key: "pets", name: "Pets", emoji: "🐾", iconKey: "pet" }
];

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function slugifyCategoryName(value: string): string {
  const normalized = normalizeCategoryName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "category";
}

export function buildUniqueCategoryKey(name: string, usedKeys: Iterable<string>): string {
  const taken = new Set(usedKeys);
  const base = slugifyCategoryName(name);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function expenseCategorySelectLabel(emoji: string, name: string): string {
  return `${emoji} ${name}`;
}
