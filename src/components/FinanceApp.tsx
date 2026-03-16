"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SOURCE_TYPE_OPTIONS,
  SourceTypeGlyph,
  sourceTypeLabel,
  sourceTypeMeta,
  sourceTypeSelectLabel,
  type SourceType
} from "@/lib/sourceTypes";
import {
  DEFAULT_CUSTOM_CATEGORY_EMOJI,
  DEFAULT_CUSTOM_CATEGORY_ICON,
  EXPENSE_CATEGORY_EMOJI_OPTIONS,
  EXPENSE_CATEGORY_ICON_OPTIONS,
  expenseCategorySelectLabel,
  type ExpenseCategoryIconKey
} from "@/lib/expense-categories";

type Currency = "USD" | "ARS";
type Tab = "dashboard" | "tracker" | "expenses" | "forecast" | "settings";
type ExpenseDisplayMode = "STORED" | Currency;
type ExpenseTimeFilter =
  | "TODAY"
  | "CURRENT_WEEK"
  | "CURRENT_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_7_DAYS"
  | "CUSTOM_MONTH"
  | "ALL_TIME";

const EXPENSE_TIME_FILTERS: Array<{ value: ExpenseTimeFilter; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "CURRENT_WEEK", label: "Current week" },
  { value: "LAST_7_DAYS", label: "Last 7 days" },
  { value: "CURRENT_MONTH", label: "Current month" },
  { value: "LAST_MONTH", label: "Last month" },
  { value: "LAST_3_MONTHS", label: "Last 3 months" },
  { value: "CUSTOM_MONTH", label: "Specific month" },
  { value: "ALL_TIME", label: "All time" }
];

function sourceTypeOptionLabel(value: SourceType | string | null | undefined, name: string): string {
  const SELECT_STYLE: "emoji" | "text" = "emoji";
  return sourceTypeSelectLabel(value, name, SELECT_STYLE);
}

function findCardById(cards: Card[], cardId: string): Card | undefined {
  return cards.find((card) => card.id === cardId);
}

function findCategoryById(categories: ExpenseCategory[], categoryId: string | null): ExpenseCategory | undefined {
  if (!categoryId) return undefined;
  return categories.find((category) => category.id === categoryId);
}

const MOBILE_TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "dashboard", label: "Home", icon: "◉" },
  { id: "tracker", label: "Tracking", icon: "◈" },
  { id: "expenses", label: "Expenses", icon: "◎" },
  { id: "forecast", label: "Forecast", icon: "◌" },
  { id: "settings", label: "Settings", icon: "◍" }
];

const CREATE_CATEGORY_OPTION = "__create_category__";
const UNCATEGORIZED_FILTER_OPTION = "__uncategorized__";

interface Card {
  id: string;
  name: string;
  currency: Currency;
  sourceType: SourceType;
  isActive: boolean;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  description: string | null;
  categoryId: string | null;
  category: ExpenseCategory | null;
  cardId: string;
  card: Card;
}

interface ExpenseCategory {
  id: string;
  key: string;
  name: string;
  emoji: string;
  iconKey: ExpenseCategoryIconKey;
  isDefault: boolean;
  isActive: boolean;
}

interface Income {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
}

interface Expectation {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  cardId: string;
  card: Card;
}

interface ExchangeRate {
  id: string;
  date: string;
  arsPerUsd: number;
  source: string | null;
  createdAt: string;
}

interface MonthlyAdjustment {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  note: string | null;
}

interface Advancement {
  id: string;
  month: string;
  amount: number;
  currency: Currency;
  note: string | null;
  isActive: boolean;
}

interface ProjectionRow {
  month: string;
  incomeUsd: number;
  fixedExpensesUsd: number;
  cardPaymentUsd: number;
  advancementImpactUsd: number;
  manualAdjustmentUsd: number;
  totalExpensesUsd: number;
  netUsd: number;
  cumulativeSavingsUsd: number;
}

interface ProjectionData {
  currentMonth: string;
  paymentMonth: string;
  currentRateArsPerUsd: number;
  fxStatus: {
    isConfigured: boolean;
    isStale: boolean;
    lastUpdatedDate: string | null;
    staleAfterDays: number;
  };
  startMonth: string;
  rows: ProjectionRow[];
  cardTracker: {
    cardId: string;
    cardName: string;
    currentCycleUsd: number;
    expectedCycleUsd: number;
    remainingExpectedUsd: number;
    currentCycleArs: number;
    expectedCycleArs: number;
    remainingExpectedArs: number;
    lastExpenseDate: string | null;
  }[];
  dashboard: {
    incomeUsd: number;
    expectedExpensesUsd: number;
    projectedSavingsUsd: number;
    nextCardPaymentUsd: number;
    nextCardPaymentArs: number;
  };
}

interface Bootstrap {
  currentUser: {
    id: string;
    username: string;
  } | null;
  projection: ProjectionData;
  cards: Card[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  incomes: Income[];
  fixedExpenses: FixedExpense[];
  expectations: Expectation[];
  exchangeRates: ExchangeRate[];
  monthlyAdjustments: MonthlyAdjustment[];
  advancements: Advancement[];
}

const USD_FORMAT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const ARS_FORMAT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2
});

function formatCodeAmount(amount: number, currency: Currency): string {
  const locale = currency === "ARS" ? "es-AR" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  return `${currency} ${formatted}`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});

function toMonthLabel(month: string): string {
  return MONTH_FORMAT.format(new Date(`${month}-01T00:00:00.000Z`));
}

function toLocalDateTimeLabel(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcExpenseDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return toUtcDateKey(date);
}

function toMonthKeyFromDateLike(value: string): string {
  return toUtcExpenseDateKey(value).slice(0, 7);
}

function toLocalExpenseDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return toLocalDateKey(date);
}

function expenseDateTimeIso(date: string, useNow: boolean): string {
  if (useNow) return new Date().toISOString();
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!year || !month || !day) return new Date().toISOString();
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  return localMidnight.toISOString();
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function parseApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed: ${response.status}`;

  try {
    const payload = JSON.parse(text) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    if (payload.error && typeof payload.error === "object") return "Validation error";
  } catch {
    // Non-JSON payloads keep original text fallback below.
  }

  return text;
}

async function refreshSessionToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function api<T>(url: string, options?: RequestInit, allowRefresh = true): Promise<T> {
  const method = options?.method?.toUpperCase() ?? "GET";
  const hasBody = options?.body !== undefined;
  const headers = new Headers(options?.headers ?? {});
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers
  });

  if (response.status === 401 && allowRefresh && !url.startsWith("/api/auth/")) {
    const refreshed = await refreshSessionToken();
    if (refreshed) {
      return api<T>(url, options, false);
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseApiErrorMessage(response));
  }

  if (response.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const year = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${mm}`;
}

function triggerHaptic() {
  if (typeof navigator === "undefined") return;
  if ("vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expenseDateBounds(filter: ExpenseTimeFilter, customMonth: string): { from: string | null; to: string | null } {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = toUtcDateKey(todayUtc);

  if (filter === "ALL_TIME") return { from: null, to: null };
  if (filter === "TODAY") return { from: todayKey, to: todayKey };
  if (filter === "CURRENT_MONTH") {
    const monthStart = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
    return { from: toUtcDateKey(monthStart), to: todayKey };
  }
  if (filter === "LAST_MONTH") {
    const lastMonthStart = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 0));
    return { from: toUtcDateKey(lastMonthStart), to: toUtcDateKey(lastMonthEnd) };
  }
  if (filter === "LAST_3_MONTHS") {
    const start = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - 2, 1));
    return { from: toUtcDateKey(start), to: todayKey };
  }
  if (filter === "LAST_7_DAYS") {
    const start = new Date(todayUtc);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: toUtcDateKey(start), to: todayKey };
  }
  if (filter === "CUSTOM_MONTH") {
    const [yearRaw, monthRaw] = customMonth.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!year || !month) return { from: null, to: null };
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return { from: toUtcDateKey(start), to: toUtcDateKey(end) };
  }

  const weekStart = new Date(todayUtc);
  const day = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - day);
  return { from: toUtcDateKey(weekStart), to: todayKey };
}

export function FinanceApp() {
  const SYNC_COOLDOWN_MS = 25000;
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busyTab, setBusyTab] = useState<Tab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [passwordForm, setPasswordForm] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [fxScenarioRateInput, setFxScenarioRateInput] = useState("");
  const [topActionMode, setTopActionMode] = useState<"currency" | "menu">("currency");
  const [loaderStatus, setLoaderStatus] = useState("Starting...");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncRef = useRef<number>(0);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [editingExpectationId, setEditingExpectationId] = useState<string | null>(null);
  const [editingAdvancementId, setEditingAdvancementId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);

  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, string>>({});
  const [debouncedAdjustmentDrafts, setDebouncedAdjustmentDrafts] = useState<Record<string, string>>({});
  const [visiblePastMonths, setVisiblePastMonths] = useState(0);
  const [visibleFutureMonths, setVisibleFutureMonths] = useState(0);
  const [topDocked, setTopDocked] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  const [expenseFilterCard, setExpenseFilterCard] = useState<string>("all");
  const [expenseFilterCategory, setExpenseFilterCategory] = useState<string>("all");
  const [expenseTimeFilter, setExpenseTimeFilter] = useState<ExpenseTimeFilter>("LAST_7_DAYS");
  const [expenseCustomMonth, setExpenseCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [expenseDisplayMode, setExpenseDisplayMode] = useState<ExpenseDisplayMode>("STORED");
  const [expenseDateTouched, setExpenseDateTouched] = useState(false);
  const [showQuickCategoryForm, setShowQuickCategoryForm] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    cardId: "",
    categoryId: "",
    amount: "",
    currency: "USD" as Currency,
    description: ""
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    emoji: DEFAULT_CUSTOM_CATEGORY_EMOJI,
    iconKey: DEFAULT_CUSTOM_CATEGORY_ICON as ExpenseCategoryIconKey
  });

  const [cardForm, setCardForm] = useState({ name: "", currency: "USD" as Currency, sourceType: "CREDIT_CARD" as SourceType });
  const [incomeForm, setIncomeForm] = useState({
    name: "",
    amount: "",
    currency: "USD" as Currency,
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: ""
  });
  const [fixedForm, setFixedForm] = useState({
    name: "",
    amount: "",
    currency: "USD" as Currency,
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: ""
  });
  const [expectationForm, setExpectationForm] = useState({
    cardId: "",
    month: new Date().toISOString().slice(0, 7),
    amount: "",
    currency: "ARS" as Currency,
    repeatMonths: "1"
  });
  const [advancementForm, setAdvancementForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: "",
    currency: "ARS" as Currency,
    note: ""
  });
  const [rateForm, setRateForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    arsPerUsd: ""
  });

  async function fetchBootstrap(force = true) {
    if (!force && lastSyncRef.current > 0 && Date.now() - lastSyncRef.current < SYNC_COOLDOWN_MS) {
      return;
    }
    console.info("[loader] fetching bootstrap data");
    setLoaderStatus("Loading latest data...");
    const payload = await api<Bootstrap>("/api/projections");
    const syncedAt = Date.now();
    lastSyncRef.current = syncedAt;
    setLastSyncedAt(syncedAt);
    setAuthRequired(false);
    setData(payload);
    setAdjustmentDrafts(Object.fromEntries(payload.monthlyAdjustments.map((row) => [row.month, String(row.amount)])));
    setDebouncedAdjustmentDrafts(Object.fromEntries(payload.monthlyAdjustments.map((row) => [row.month, String(row.amount)])));
    setVisiblePastMonths(0);
    setVisibleFutureMonths(0);

    if ((!expenseForm.cardId && payload.cards[0]) || (!expenseForm.categoryId && payload.categories[0])) {
      setExpenseForm((prev) => ({
        ...prev,
        cardId: prev.cardId || payload.cards[0]?.id || "",
        categoryId: prev.categoryId || payload.categories[0]?.id || ""
      }));
    }
    if (!expectationForm.cardId && payload.cards[0]) {
      setExpectationForm((prev) => ({ ...prev, cardId: payload.cards[0].id }));
    }
  }

  async function runTabAction(tab: Tab, action: () => Promise<void>): Promise<boolean> {
    setBusyTab(tab);
    setLoaderStatus(`Applying changes in ${tab}...`);
    console.info(`[loader] running action for tab=${tab}`);
    let success = false;
    try {
      await action();
      await fetchBootstrap(true);
      setError(null);
      success = true;
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAuthRequired(true);
        setAuthError("Session expired. Enter credentials again.");
      } else {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    } finally {
      setBusyTab(null);
    }
    return success;
  }

  useEffect(() => {
    (async () => {
      try {
        await fetchBootstrap(true);
      } catch (err) {
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
          setAuthRequired(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("finance_username");
    if (saved) {
      setAuthUsername(saved);
    }
  }, []);

  useEffect(() => {
    if (!authRequired) return;
    setPasswordFeedback(null);
  }, [authRequired]);

  useEffect(() => {
    if (!passwordFeedback) return;
    const timer = setTimeout(() => setPasswordFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [passwordFeedback]);

  useEffect(() => {
    if (!data) return;
    if (fxScenarioRateInput.trim().length > 0) return;
    setFxScenarioRateInput(data.projection.currentRateArsPerUsd.toFixed(2));
  }, [data, fxScenarioRateInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    void syncIfStale();
  }, [activeTab]);

  useEffect(() => {
    function handleFocus() {
      void syncIfStale();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void syncIfStale();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialLoading, authRequired, isSyncing]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAdjustmentDrafts(adjustmentDrafts);
    }, 350);

    return () => clearTimeout(timer);
  }, [adjustmentDrafts]);

  useEffect(() => {
    function updateDock() {
      const header = headerRef.current;
      if (!header) return;
      const bottom = header.getBoundingClientRect().bottom;
      setTopDocked(bottom <= 12);
    }

    updateDock();
    window.addEventListener("scroll", updateDock, { passive: true });
    window.addEventListener("resize", updateDock);
    return () => {
      window.removeEventListener("scroll", updateDock);
      window.removeEventListener("resize", updateDock);
    };
  }, []);

  const filteredExpenses = useMemo(() => {
    if (!data) return [];
    const bounds = expenseDateBounds(expenseTimeFilter, expenseCustomMonth);
    return data.expenses.filter((expense) => {
      const byCard = expenseFilterCard === "all" || expense.cardId === expenseFilterCard;
      const byCategory =
        expenseFilterCategory === "all" ||
        (expenseFilterCategory === UNCATEGORIZED_FILTER_OPTION
          ? expense.categoryId == null
          : expense.categoryId === expenseFilterCategory);
      const expenseDateKey = toUtcExpenseDateKey(expense.date);
      const byFrom = !bounds.from || expenseDateKey >= bounds.from;
      const byTo = !bounds.to || expenseDateKey <= bounds.to;
      return byCard && byCategory && byFrom && byTo;
    });
  }, [data, expenseFilterCard, expenseFilterCategory, expenseTimeFilter, expenseCustomMonth]);

  const sortedIncomes = useMemo(() => {
    if (!data) return [];
    return [...data.incomes].sort((a, b) => {
      const byStart = b.startMonth.localeCompare(a.startMonth);
      if (byStart !== 0) return byStart;
      return b.name.localeCompare(a.name);
    });
  }, [data]);

  const sortedFixedExpenses = useMemo(() => {
    if (!data) return [];
    return [...data.fixedExpenses].sort((a, b) => {
      const byStart = b.startMonth.localeCompare(a.startMonth);
      if (byStart !== 0) return byStart;
      return b.name.localeCompare(a.name);
    });
  }, [data]);

  const sortedAdvancements = useMemo(() => {
    if (!data) return [];
    return [...data.advancements].sort((a, b) => b.month.localeCompare(a.month));
  }, [data]);

  const sortedExchangeRates = useMemo(() => {
    if (!data) return [];
    return [...data.exchangeRates]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [data]);

  const getArsPerUsdForMonth = useMemo(() => {
    const fallback = data?.projection.currentRateArsPerUsd ?? 1;
    if (!data || data.exchangeRates.length === 0) {
      return (_month: string) => fallback;
    }

    const monthly = [...data.exchangeRates]
      .map((rate) => ({ month: rate.date.slice(0, 7), arsPerUsd: rate.arsPerUsd }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const rateByMonth = new Map<string, number>();
    for (const row of monthly) {
      rateByMonth.set(row.month, row.arsPerUsd);
    }

    return (month: string): number => {
      const exact = rateByMonth.get(month);
      if (typeof exact === "number" && Number.isFinite(exact) && exact > 0) return exact;

      for (let i = monthly.length - 1; i >= 0; i -= 1) {
        if (monthly[i].month <= month) return monthly[i].arsPerUsd;
      }
      return fallback;
    };
  }, [data]);

  const getArsPerUsdForDate = useMemo(() => {
    return (dateLike: string): number => {
      const month = toMonthKeyFromDateLike(dateLike);
      return getArsPerUsdForMonth(month);
    };
  }, [getArsPerUsdForMonth]);

  const sortedCategories = useMemo(() => {
    if (!data) return [];
    return [...data.categories].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const expectationGroups = useMemo(() => {
    if (!data) return [];

    const currentMonth = data.projection.currentMonth;
    const grouped = new Map<string, { card: Card; rows: Expectation[] }>();

    for (const row of data.expectations) {
      if (row.month < currentMonth) continue;
      const existing = grouped.get(row.cardId);
      if (existing) {
        existing.rows.push(row);
      } else {
        grouped.set(row.cardId, { card: row.card, rows: [row] });
      }
    }

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) => b.month.localeCompare(a.month))
      }))
      .sort((a, b) => {
        const aLatest = a.rows[0]?.month ?? "";
        const bLatest = b.rows[0]?.month ?? "";
        const byLatest = bLatest.localeCompare(aLatest);
        if (byLatest !== 0) return byLatest;
        return b.card.name.localeCompare(a.card.name);
      });
  }, [data]);

  const forecastRows = useMemo(() => {
    if (!data) return [];
    const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);

    let savings = 0;
    return data.projection.rows.map((row) => {
      let adjustment = row.manualAdjustmentUsd;
      const editable = editableMonths.has(row.month);
      if (editable && row.month in debouncedAdjustmentDrafts) {
        const raw = debouncedAdjustmentDrafts[row.month];
        if (raw.trim() === "") {
          adjustment = 0;
        } else {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) adjustment = parsed;
        }
      }

      const net = row.incomeUsd - row.totalExpensesUsd + adjustment;
      savings += net;
      return {
        ...row,
        previewAdjustmentUsd: adjustment,
        previewNetUsd: net,
        previewSavingsUsd: savings
      };
    });
  }, [data, debouncedAdjustmentDrafts]);

  const forecastWindow = useMemo(() => {
    if (!data || forecastRows.length === 0) {
      return { rows: [], canLoadPrev: false, canLoadNext: false };
    }

    const currentYear = data.projection.currentMonth.slice(0, 4);
    const defaultStart = `${currentYear}-01`;
    const defaultEnd = `${currentYear}-12`;
    const availableStart = forecastRows[0].month;
    const availableEnd = forecastRows[forecastRows.length - 1].month;

    const requestedStart = shiftMonth(defaultStart, -visiblePastMonths);
    const requestedEnd = shiftMonth(defaultEnd, visibleFutureMonths);
    const windowStart = requestedStart < availableStart ? availableStart : requestedStart;
    const windowEnd = requestedEnd > availableEnd ? availableEnd : requestedEnd;

    return {
      rows: forecastRows.filter((row) => row.month >= windowStart && row.month <= windowEnd),
      canLoadPrev: windowStart > availableStart,
      canLoadNext: windowEnd < availableEnd
    };
  }, [data, forecastRows, visiblePastMonths, visibleFutureMonths]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    setIsAuthSubmitting(true);
    const trimmedUsername = authUsername.trim();
    if (!trimmedUsername) {
      setAuthError("Username is required");
      setIsAuthSubmitting(false);
      return;
    }
    setLoaderStatus(authMode === "register" ? "Creating account..." : "Authenticating...");
    console.info(`[auth] submitting ${authMode} for user=${trimmedUsername}`);
    try {
      await api(authMode === "register" ? "/api/auth/register" : "/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ username: trimmedUsername, password: authPassword })
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem("finance_username", trimmedUsername);
      }
      setAuthPassword("");
      setError(null);
      setLoaderStatus("Loading your data...");
      console.info("[auth] success");
      try {
        await fetchBootstrap(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Safari can commit Set-Cookie slightly after the auth response resolves.
          await sleep(350);
          await fetchBootstrap(true);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.info("[auth] failed");
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);
    setBusyTab(activeTab);
    setLoaderStatus("Logging out...");
    console.info("[auth] logging out");
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setData(null);
      setAuthRequired(true);
      setAuthMode("login");
      setAuthPassword("");
      setPasswordFeedback(null);
      setBusyTab(null);
      setInitialLoading(false);
      setLoaderStatus("Logged out");
      setIsLoggingOut(false);
    }
  }

  function formatMoney(usdValue: number, month?: string) {
    if (!data) return "-";
    if (displayCurrency === "USD") return USD_FORMAT.format(usdValue);
    const rate = month ? getArsPerUsdForMonth(month) : data.projection.currentRateArsPerUsd;
    return ARS_FORMAT.format(usdValue * rate);
  }

  function dualCurrencyMetric(usdValue: number) {
    const arsValue = usdValue * (data?.projection.currentRateArsPerUsd ?? 1);
    const primary = displayCurrency === "USD" ? USD_FORMAT.format(usdValue) : ARS_FORMAT.format(arsValue);
    const secondary = displayCurrency === "USD" ? ARS_FORMAT.format(arsValue) : USD_FORMAT.format(usdValue);
    return { primary, secondary };
  }

  function formatLastSync(value: number | null) {
    if (!value) return "--:--:--";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  }

  async function syncNow() {
    setIsSyncing(true);
    setLoaderStatus("Syncing data...");
    try {
      await fetchBootstrap(true);
      setError(null);
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        setAuthRequired(true);
        setAuthError("Session expired. Enter credentials again.");
      } else {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncIfStale() {
    if (initialLoading || authRequired || isSyncing) return;
    try {
      await fetchBootstrap(false);
    } catch {
      // ignore auto-refresh failures
    }
  }

  function renderTopActionSwitcher(forceMenu = false) {
    const isMenuMode = forceMenu || topActionMode === "menu";
    const isExpensesTab = activeTab === "expenses";
    return (
      <div className={`currencyToggle actionSwitcher ${isExpensesTab ? "expenseMode" : ""}`}>
        {isMenuMode ? (
          <>
            <span className="syncStatus">Synced {formatLastSync(lastSyncedAt)}</span>
            <button className="secondary syncInlineBtn" disabled={isSyncing} onClick={() => void syncNow()}>
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
            <button className="secondary logoutInlineBtn" disabled={isLoggingOut} onClick={() => void logout()}>
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </>
        ) : isExpensesTab ? (
          <>
            <span className="amountViewLabel">View</span>
            <button className={`currencyBtn ${expenseDisplayMode === "STORED" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("STORED")}>Stored</button>
            <button className={`currencyBtn ${expenseDisplayMode === "USD" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("USD")}>USD</button>
            <button className={`currencyBtn ${expenseDisplayMode === "ARS" ? "active" : ""}`} onClick={() => setExpenseDisplayMode("ARS")}>ARS</button>
          </>
        ) : (
          <>
            <span>Currency</span>
            <button className={`currencyBtn ${displayCurrency === "USD" ? "active" : ""}`} onClick={() => setDisplayCurrency("USD")}>USD</button>
            <button className={`currencyBtn ${displayCurrency === "ARS" ? "active" : ""}`} onClick={() => setDisplayCurrency("ARS")}>ARS</button>
          </>
        )}
        {!forceMenu ? (
          <button
            type="button"
            className="menuToggleBtn"
            onClick={() => setTopActionMode((prev) => (prev === "currency" ? "menu" : "currency"))}
            aria-label="Toggle quick actions"
          >
            {topActionMode === "currency" ? "⚙" : "←"}
          </button>
        ) : null}
      </div>
    );
  }

  function trackerStatus(row: ProjectionData["cardTracker"][number]): "over" | "warning" | "ok" | "none" {
    if (row.expectedCycleUsd <= 0) return "none";
    if (row.currentCycleUsd >= row.expectedCycleUsd) return "over";
    if (row.currentCycleUsd / row.expectedCycleUsd >= 0.85) return "warning";
    return "ok";
  }

  async function createExpenseCategory(
    payload: { name: string; emoji: string; iconKey: ExpenseCategoryIconKey },
    tab: Tab,
    selectInExpenseForm: boolean
  ) {
    const normalizedName = payload.name.trim();
    if (!normalizedName) {
      setError("Category name is required");
      return;
    }

    let created: ExpenseCategory | null = null;
    const success = await runTabAction(tab, async () => {
      created = await api<ExpenseCategory>("/api/expense-categories", {
        method: "POST",
        body: JSON.stringify({
          name: normalizedName,
          emoji: payload.emoji,
          iconKey: payload.iconKey
        })
      });
    });

    if (success) {
      if (selectInExpenseForm && created) {
        setExpenseForm((prev) => ({ ...prev, categoryId: created?.id ?? prev.categoryId }));
      }
      setCategoryForm({
        name: "",
        emoji: DEFAULT_CUSTOM_CATEGORY_EMOJI,
        iconKey: DEFAULT_CUSTOM_CATEGORY_ICON
      });
      setShowQuickCategoryForm(false);
    }
  }

  async function submitCategory(event: React.FormEvent) {
    event.preventDefault();
    await createExpenseCategory(categoryForm, "settings", false);
  }

  async function submitQuickCategory(event: React.FormEvent) {
    event.preventDefault();
    await createExpenseCategory(categoryForm, "expenses", true);
  }

  async function updateCategory(payload: { id: string; name: string; emoji: string; iconKey: ExpenseCategoryIconKey }) {
    await runTabAction("settings", async () => {
      await api("/api/expense-categories", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingCategoryId(null);
    });
  }

  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...expenseForm,
          categoryId: expenseForm.categoryId || null,
          dateTimeIso: expenseDateTimeIso(expenseForm.date, !expenseDateTouched),
          amount: Number(expenseForm.amount)
        })
      });
      setExpenseForm({
        date: new Date().toISOString().slice(0, 10),
        cardId: expenseForm.cardId || data?.cards[0]?.id || "",
        categoryId: expenseForm.categoryId || data?.categories[0]?.id || "",
        amount: "",
        currency: "USD",
        description: ""
      });
      setExpenseDateTouched(false);
    });
  }

  function handleExpenseCategorySelect(value: string) {
    if (value === CREATE_CATEGORY_OPTION) {
      setShowQuickCategoryForm(true);
      setExpenseForm((prev) => ({ ...prev, categoryId: "" }));
      return;
    }
    setShowQuickCategoryForm(false);
    setExpenseForm((prev) => ({ ...prev, categoryId: value }));
  }

  async function updateExpense(expense: Expense, originalExpense: Expense) {
    const payload: Partial<Expense> & { id: string; dateTimeIso?: string } = { id: expense.id };
    if (expense.amount !== originalExpense.amount) payload.amount = expense.amount;
    if (expense.cardId !== originalExpense.cardId) payload.cardId = expense.cardId;
    if ((expense.categoryId ?? null) !== (originalExpense.categoryId ?? null)) payload.categoryId = expense.categoryId;
    if (expense.currency !== originalExpense.currency) payload.currency = expense.currency;
    if ((expense.description ?? "") !== (originalExpense.description ?? "")) payload.description = expense.description;
    const expenseDateKey = toLocalExpenseDateKey(expense.date);
    const originalDateKey = toLocalExpenseDateKey(originalExpense.date);
    if (expenseDateKey !== originalDateKey) payload.dateTimeIso = expenseDateTimeIso(expenseDateKey, false);
    if (Object.keys(payload).length === 1) {
      setEditingExpenseId(null);
      return;
    }

    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingExpenseId(null);
    });
  }

  async function deleteExpense(id: string) {
    await runTabAction("expenses", async () => {
      await api("/api/expenses", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitCard(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/cards", { method: "POST", body: JSON.stringify(cardForm) });
      setCardForm({ name: "", currency: "USD", sourceType: "CREDIT_CARD" });
    });
  }

  async function updateCard(card: Partial<Card> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/cards", {
        method: "PATCH",
        body: JSON.stringify(card)
      });
      setEditingCardId(null);
    });
  }

  async function toggleCard(card: Card) {
    await updateCard({ id: card.id, isActive: !card.isActive });
  }

  async function submitIncome(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/incomes", {
        method: "POST",
        body: JSON.stringify({
          ...incomeForm,
          amount: Number(incomeForm.amount),
          endMonth: incomeForm.endMonth || null
        })
      });
      setIncomeForm((prev) => ({ ...prev, name: "", amount: "", endMonth: "" }));
    });
  }

  async function updateIncome(payload: Partial<Income> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/incomes", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingIncomeId(null);
    });
  }

  async function toggleIncome(income: Income) {
    await updateIncome({ id: income.id, isActive: !income.isActive });
  }

  async function submitFixed(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/fixed-expenses", {
        method: "POST",
        body: JSON.stringify({
          ...fixedForm,
          amount: Number(fixedForm.amount),
          endMonth: fixedForm.endMonth || null
        })
      });
      setFixedForm((prev) => ({ ...prev, name: "", amount: "", endMonth: "" }));
    });
  }

  async function updateFixed(payload: Partial<FixedExpense> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/fixed-expenses", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingFixedId(null);
    });
  }

  async function toggleFixed(item: FixedExpense) {
    await updateFixed({ id: item.id, isActive: !item.isActive });
  }

  async function submitExpectation(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "POST",
        body: JSON.stringify({
          ...expectationForm,
          amount: Number(expectationForm.amount),
          repeatMonths: Number(expectationForm.repeatMonths)
        })
      });
      setExpectationForm((prev) => ({ ...prev, amount: "" }));
    });
  }

  async function updateExpectation(payload: Partial<Expectation> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingExpectationId(null);
    });
  }

  async function deleteExpectation(id: string) {
    await runTabAction("settings", async () => {
      await api("/api/expectations", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitAdvancement(event: React.FormEvent) {
    event.preventDefault();
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "POST",
        body: JSON.stringify({
          ...advancementForm,
          amount: Number(advancementForm.amount)
        })
      });
      setAdvancementForm((prev) => ({ ...prev, amount: "", note: "" }));
    });
  }

  async function updateAdvancement(payload: Partial<Advancement> & { id: string }) {
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setEditingAdvancementId(null);
    });
  }

  async function deleteAdvancement(id: string) {
    await runTabAction("settings", async () => {
      await api("/api/advancements", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
    });
  }

  async function submitRate(event: React.FormEvent) {
    event.preventDefault();
    const targetMonth = rateForm.date.slice(0, 7);
    const isEditingPastMonth = Boolean(editingRateId && data && targetMonth < data.projection.currentMonth);
    if (isEditingPastMonth) {
      const confirmed = window.confirm(
        `You are editing a past exchange rate (${targetMonth}). This will recalculate historical values for that month. Continue?`
      );
      if (!confirmed) return;
    }

    await runTabAction("settings", async () => {
      await api("/api/exchange-rates", {
        method: editingRateId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editingRateId ? { id: editingRateId } : {}),
          ...rateForm,
          arsPerUsd: Number(rateForm.arsPerUsd),
          source: "manual"
        })
      });
      setEditingRateId(null);
      setRateForm((prev) => ({ ...prev, arsPerUsd: "" }));
    });
  }

  function startEditRate(rate: ExchangeRate) {
    setEditingRateId(rate.id);
    setRateForm({
      date: rate.date,
      arsPerUsd: String(rate.arsPerUsd)
    });
  }

  function cancelEditRate() {
    setEditingRateId(null);
    setRateForm((prev) => ({ ...prev, arsPerUsd: "" }));
  }

  async function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordForm.trim()) {
      setPasswordFeedback("Password cannot be empty.");
      return;
    }

    setPasswordFeedback(null);
    const ok = await runTabAction("settings", async () => {
      await api("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ password: passwordForm })
      });
    });

    if (ok) {
      setPasswordForm("");
      setPasswordFeedback("Password updated.");
    }
  }

  async function syncRate() {
    await runTabAction("settings", async () => {
      await api("/api/exchange-rates/fetch", { method: "POST" });
    });
  }

  async function saveAdjustment(month: string) {
    const raw = adjustmentDrafts[month] ?? "";
    await runTabAction("forecast", async () => {
      if (!raw.trim()) {
        await api("/api/monthly-adjustments", {
          method: "DELETE",
          body: JSON.stringify({ month })
        });
        return;
      }

      await api("/api/monthly-adjustments", {
        method: "PUT",
        body: JSON.stringify({
          month,
          amount: Number(raw),
          currency: "USD",
          note: "manual month correction"
        })
      });
    });
  }

  if (initialLoading) {
    return (
      <main className="container">
        <section className="panel authPanel">
          <div className="authLoading">
            <div className="spinner" />
            <h2>Loading</h2>
            <p>{loaderStatus}</p>
          </div>
        </section>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="container">
        <section className="panel authPanel">
          <div className="authHeader">
            <h2>{authMode === "register" ? "Create Account" : "Welcome Back"}</h2>
            <p className="subtle">{authMode === "register" ? "Create a new user and password to start." : "Sign in with your username and password."}</p>
          </div>
          <div className="authModeSwitch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              disabled={isAuthSubmitting}
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              disabled={isAuthSubmitting}
              onClick={() => {
                setAuthMode("register");
                setAuthError(null);
              }}
            >
              Create User
            </button>
          </div>
          <form className="formGrid authForm" onSubmit={submitAuth}>
            <label className="fieldLabel">
              <span>Username</span>
              <input
                type="text"
                placeholder="julian"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={isAuthSubmitting}
                required
              />
            </label>
            <label className="fieldLabel">
              <span>Password</span>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                disabled={isAuthSubmitting}
                required
              />
            </label>
            <button type="submit" disabled={isAuthSubmitting}>
              {isAuthSubmitting ? (authMode === "register" ? "Creating..." : "Signing in...") : authMode === "register" ? "Create User" : "Sign In"}
            </button>
          </form>
          {isAuthSubmitting ? <p className="subtle authStatus">{loaderStatus}</p> : null}
          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container">
        <h1>Personal Finance Forecasting</h1>
        <p className="error">{error || "Unknown error"}</p>
        <button
          onClick={() => {
            setInitialLoading(true);
            setError(null);
            void (async () => {
              try {
                await fetchBootstrap();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load data");
              } finally {
                setInitialLoading(false);
              }
            })();
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  const trackerRemainingUsdTotal = data.projection.cardTracker.reduce(
    (acc, row) => (row.expectedCycleUsd > 0 ? acc + row.remainingExpectedUsd : acc),
    0
  );
  const trackerRemainingMetric = dualCurrencyMetric(trackerRemainingUsdTotal);
  const dashboardStartMonth = shiftMonth(data.projection.currentMonth, -6);
  const dashboardEndMonth = shiftMonth(data.projection.currentMonth, 6);
  const dashboardRows = data.projection.rows.filter(
    (row) => row.month >= dashboardStartMonth && row.month <= dashboardEndMonth
  );
  const dashboardMonths = dashboardRows.map((row) => row.month);
  const dashboardCurrentRow = data.projection.rows.find((row) => row.month === data.projection.currentMonth);
  const nextMonthKey = shiftMonth(data.projection.currentMonth, 1);
  const nextMonthRow = data.projection.rows.find((row) => row.month === nextMonthKey);
  const savingsTargetRow = data.projection.rows.find((row) => row.month === shiftMonth(data.projection.currentMonth, 11));
  const savings12mUsd =
    (savingsTargetRow?.cumulativeSavingsUsd ?? data.projection.rows[data.projection.rows.length - 1]?.cumulativeSavingsUsd ?? 0) -
    (dashboardCurrentRow?.cumulativeSavingsUsd ?? 0);
  const currentRate = getArsPerUsdForMonth(data.projection.currentMonth);

  const expenseUsdByMonthCard = new Map<string, Map<string, number>>();
  for (const expense of data.expenses) {
    const month = toUtcExpenseDateKey(expense.date).slice(0, 7);
    const usd = expense.currency === "USD" ? expense.amount : expense.amount / getArsPerUsdForDate(expense.date);
    if (!expenseUsdByMonthCard.has(month)) {
      expenseUsdByMonthCard.set(month, new Map<string, number>());
    }
    const cardMap = expenseUsdByMonthCard.get(month)!;
    cardMap.set(expense.cardId, (cardMap.get(expense.cardId) ?? 0) + usd);
  }

  const expectedUsdByMonthCard = new Map<string, Map<string, number>>();
  for (const expectation of data.expectations) {
    const usd = expectation.currency === "USD" ? expectation.amount : expectation.amount / getArsPerUsdForMonth(expectation.month);
    if (!expectedUsdByMonthCard.has(expectation.month)) {
      expectedUsdByMonthCard.set(expectation.month, new Map<string, number>());
    }
    const cardMap = expectedUsdByMonthCard.get(expectation.month)!;
    cardMap.set(expectation.cardId, (cardMap.get(expectation.cardId) ?? 0) + usd);
  }

  const expectedPaymentForMonthUsd = (month: string) =>
    [...(expectedUsdByMonthCard.get(month)?.values() ?? [])].reduce((acc, value) => acc + value, 0);

  const actualPaymentForMonthUsd = (month: string) => {
    const previousMonth = shiftMonth(month, -1);
    const total = data.cards.reduce((acc, card) => {
      const sourceMonth = card.sourceType === "CREDIT_CARD" ? previousMonth : month;
      return acc + (expenseUsdByMonthCard.get(sourceMonth)?.get(card.id) ?? 0);
    }, 0);
    return total || expectedPaymentForMonthUsd(month);
  };

  const recentAccuracyPoints = [1, 2, 3]
    .map((delta) => shiftMonth(data.projection.currentMonth, -delta))
    .map((month) => {
      const expected = expectedPaymentForMonthUsd(month);
      const actual = actualPaymentForMonthUsd(month);
      if (expected <= 0 && actual <= 0) return null;
      if (expected <= 0) return 0;
      return Math.max(0, 100 - (Math.abs(actual - expected) / expected) * 100);
    })
    .filter((value): value is number => typeof value === "number");

  const forecastAccuracyPct =
    recentAccuracyPoints.length > 0
      ? recentAccuracyPoints.reduce((acc, value) => acc + value, 0) / recentAccuracyPoints.length
      : 100;

  const riskDeviationHistory = [1, 2, 3, 4, 5, 6]
    .map((delta) => shiftMonth(data.projection.currentMonth, -delta))
    .map((month) => actualPaymentForMonthUsd(month) - expectedPaymentForMonthUsd(month))
    .filter((value) => Number.isFinite(value));

  const riskMean =
    riskDeviationHistory.length > 0
      ? riskDeviationHistory.reduce((acc, value) => acc + value, 0) / riskDeviationHistory.length
      : 0;
  const riskStdDev =
    riskDeviationHistory.length > 0
      ? Math.sqrt(
          riskDeviationHistory.reduce((acc, value) => acc + (value - riskMean) ** 2, 0) /
            riskDeviationHistory.length
        )
      : 0;
  const nextMonthRiskBaseUsd = (nextMonthRow?.netUsd ?? 0) - riskMean;
  const nextMonthRiskBestUsd = nextMonthRiskBaseUsd + riskStdDev;
  const nextMonthRiskWorstUsd = nextMonthRiskBaseUsd - riskStdDev;

  const deviationRows = [...data.projection.cardTracker]
    .map((row) => ({
      ...row,
      deviationUsd: row.currentCycleUsd - row.expectedCycleUsd,
      deviationArs: row.currentCycleArs - row.expectedCycleArs
    }))
    .sort((a, b) => Math.abs(b.deviationUsd) - Math.abs(a.deviationUsd));
  const totalDeviationUsd = deviationRows.reduce((acc, row) => acc + row.deviationUsd, 0);

  const uncategorizedCategory: ExpenseCategory = {
    id: "uncategorized",
    key: "uncategorized",
    name: "Uncategorized",
    emoji: "🏷️",
    iconKey: "custom",
    isDefault: false,
    isActive: true
  };
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const expenseUsdByMonthCategory = new Map<string, Map<string, { usd: number; count: number }>>();
  for (const expense of data.expenses) {
    const month = toUtcExpenseDateKey(expense.date).slice(0, 7);
    const categoryId = expense.categoryId ?? uncategorizedCategory.id;
    const usd = expense.currency === "USD" ? expense.amount : expense.amount / getArsPerUsdForDate(expense.date);
    if (!expenseUsdByMonthCategory.has(month)) {
      expenseUsdByMonthCategory.set(month, new Map());
    }
    const categoryMap = expenseUsdByMonthCategory.get(month)!;
    const prev = categoryMap.get(categoryId) ?? { usd: 0, count: 0 };
    categoryMap.set(categoryId, { usd: prev.usd + usd, count: prev.count + 1 });
  }

  function categoryMeta(categoryId: string): ExpenseCategory {
    return categoryById.get(categoryId) ?? uncategorizedCategory;
  }

  const currentMonthCategoryRows = [...(expenseUsdByMonthCategory.get(data.projection.currentMonth)?.entries() ?? [])]
    .map(([categoryId, values]) => ({
      category: categoryMeta(categoryId),
      usd: values.usd,
      count: values.count
    }))
    .sort((a, b) => b.usd - a.usd);
  const currentMonthCategoryMaxUsd = currentMonthCategoryRows[0]?.usd ?? 0;

  const recentMonths = [1, 2, 3, 4, 5, 6].map((delta) => shiftMonth(data.projection.currentMonth, -delta));
  const mostUsedCategoryRows = (() => {
    const totals = new Map<string, { usd: number; count: number }>();
    for (const month of recentMonths) {
      const rows = expenseUsdByMonthCategory.get(month);
      if (!rows) continue;
      for (const [categoryId, values] of rows.entries()) {
        const prev = totals.get(categoryId) ?? { usd: 0, count: 0 };
        totals.set(categoryId, { usd: prev.usd + values.usd, count: prev.count + values.count });
      }
    }
    return [...totals.entries()]
      .map(([categoryId, values]) => ({
        category: categoryMeta(categoryId),
        usd: values.usd,
        count: values.count,
        avgTicketUsd: values.count > 0 ? values.usd / values.count : 0
      }))
      .sort((a, b) => (b.count === a.count ? b.usd - a.usd : b.count - a.count))
      .slice(0, 8);
  })();

  const categoryDeviationRows = (() => {
    const baselineMonths = [1, 2, 3].map((delta) => shiftMonth(data.projection.currentMonth, -delta));
    const baselineTotals = new Map<string, number>();
    for (const month of baselineMonths) {
      const rows = expenseUsdByMonthCategory.get(month);
      if (!rows) continue;
      for (const [categoryId, values] of rows.entries()) {
        baselineTotals.set(categoryId, (baselineTotals.get(categoryId) ?? 0) + values.usd);
      }
    }
    const currentTotals = expenseUsdByMonthCategory.get(data.projection.currentMonth) ?? new Map<string, { usd: number; count: number }>();
    const allCategoryIds = new Set<string>([
      ...baselineTotals.keys(),
      ...currentTotals.keys()
    ]);
    return [...allCategoryIds]
      .map((categoryId) => {
        const currentUsd = currentTotals.get(categoryId)?.usd ?? 0;
        const baselineUsd = (baselineTotals.get(categoryId) ?? 0) / baselineMonths.length;
        return {
          category: categoryMeta(categoryId),
          currentUsd,
          baselineUsd,
          deviationUsd: currentUsd - baselineUsd
        };
      })
      .filter((row) => row.currentUsd > 0 || row.baselineUsd > 0)
      .sort((a, b) => Math.abs(b.deviationUsd) - Math.abs(a.deviationUsd))
      .slice(0, 8);
  })();

  const currentAdjustmentUsd = dashboardCurrentRow?.manualAdjustmentUsd ?? 0;
  const adjustmentHistoryAbs = [1, 2, 3, 4, 5, 6]
    .map((delta) => data.projection.rows.find((row) => row.month === shiftMonth(data.projection.currentMonth, -delta))?.manualAdjustmentUsd ?? 0)
    .map((value) => Math.abs(value));
  const adjustmentAvgAbs6m =
    adjustmentHistoryAbs.length > 0
      ? adjustmentHistoryAbs.reduce((acc, value) => acc + value, 0) / adjustmentHistoryAbs.length
      : 0;
  const adjustmentDriftPct =
    adjustmentAvgAbs6m > 0
      ? ((adjustmentAvgAbs6m - Math.abs(currentAdjustmentUsd)) / adjustmentAvgAbs6m) * 100
      : 0;

  const parsedFxScenarioRate = Number(fxScenarioRateInput.replace(",", "."));
  const fxScenarioRate =
    Number.isFinite(parsedFxScenarioRate) && parsedFxScenarioRate > 0
      ? parsedFxScenarioRate
      : currentRate;
  const fxRateDown = currentRate * 0.9;
  const fxRateUp = currentRate * 1.1;
  const currentExpensesUsd = data.projection.dashboard.expectedExpensesUsd;
  const currentNetUsd = data.projection.dashboard.projectedSavingsUsd;
  const fxExpensesBaseArs = currentExpensesUsd * currentRate;
  const fxExpensesScenarioArs = currentExpensesUsd * fxScenarioRate;
  const fxExpensesDownArs = currentExpensesUsd * fxRateDown;
  const fxExpensesUpArs = currentExpensesUsd * fxRateUp;
  const fxNetBaseArs = currentNetUsd * currentRate;
  const fxNetScenarioArs = currentNetUsd * fxScenarioRate;
  const fxNetDownArs = currentNetUsd * fxRateDown;
  const fxNetUpArs = currentNetUsd * fxRateUp;
  const fxExpensesDeltaArs = fxExpensesScenarioArs - fxExpensesBaseArs;
  const fxNetDeltaArs = fxNetScenarioArs - fxNetBaseArs;
  const fxStatus = data.projection.fxStatus;
  const showMissingFxWarning = !fxStatus.isConfigured;
  const showStaleFxWarning = fxStatus.isConfigured && fxStatus.isStale;
  const fxLastUpdatedLabel = fxStatus.lastUpdatedDate
    ? toLocalDateTimeLabel(`${fxStatus.lastUpdatedDate}T00:00:00.000Z`)
    : null;

  return (
    <main className="container">
      <header className="header" ref={headerRef}>
        <h1>Personal Finance Forecasting</h1>
        <p>Track expenses now, project next-month cash impact, and reconcile real closes.</p>
        {data.currentUser ? (
          <div className="activeUserBadge" title="Authenticated user">
            User: {data.currentUser.username}
          </div>
        ) : null}
      </header>

      <div className={`desktopOnly topSticky ${topDocked ? "isDocked" : ""}`}>
        <div className="toolbar">
          <div className="tabs">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={activeTab === "tracker" ? "active" : ""} onClick={() => setActiveTab("tracker")}>All Expense Tracking</button>
            <button className={activeTab === "expenses" ? "active" : ""} onClick={() => setActiveTab("expenses")}>Expense Log</button>
            <button className={activeTab === "forecast" ? "active" : ""} onClick={() => setActiveTab("forecast")}>Forecast</button>
            <button className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>Settings</button>
          </div>
          <div className="toolbarRight">{renderTopActionSwitcher(activeTab === "settings")}</div>
        </div>
      </div>

      <div className={`mobileOnly topStickyMobile ${topDocked ? "isDocked" : ""}`}>
        <div className="mobileTopBar">
          {renderTopActionSwitcher(activeTab === "settings")}
        </div>
      </div>

      <div className={`sectionWrap ${busyTab === activeTab ? "isBusy" : ""} ${topDocked ? "withTopDockOffset" : ""}`}>
        {busyTab === activeTab && (
          <div className="busyOverlay">
            <div className="spinner" />
            <span>{loaderStatus}</span>
          </div>
        )}

        {showMissingFxWarning ? (
          <aside className="fxStatusBanner" role="status">
            <strong>Exchange rate not configured for this user.</strong>
            <span>
              Add at least one ARS/USD rate in Settings. Until then, projections use the default fallback rate.
            </span>
            <a href="https://www.dolarito.ar/" target="_blank" rel="noreferrer">
              Check rates on Dolarito
            </a>
          </aside>
        ) : null}

        {!showMissingFxWarning && showStaleFxWarning ? (
          <aside className="fxStatusBanner" role="status">
            <strong>Exchange rate is stale.</strong>
            <span>
              Last update: {fxLastUpdatedLabel ?? "-"} ({fxStatus.lastUpdatedDate}). It has not been updated in {fxStatus.staleAfterDays} days or more.
            </span>
            <a href="https://www.dolarito.ar/" target="_blank" rel="noreferrer">
              Check rates on Dolarito
            </a>
          </aside>
        ) : null}

        {activeTab === "dashboard" && (
          <section className="stack dashboardStack">
            <section className="dashboardKpiGrid">
              <article className="metric">
                <h3>Current Month Net</h3>
                <strong>{dualCurrencyMetric(dashboardCurrentRow?.netUsd ?? 0).primary}</strong>
                <small>{dualCurrencyMetric(dashboardCurrentRow?.netUsd ?? 0).secondary}</small>
              </article>
              <article className="metric">
                <h3>Projected Month Close</h3>
                <strong>{dualCurrencyMetric(dashboardCurrentRow?.cumulativeSavingsUsd ?? 0).primary}</strong>
                <small>{dualCurrencyMetric(dashboardCurrentRow?.cumulativeSavingsUsd ?? 0).secondary}</small>
              </article>
              <article className="metric">
                <h3>Total Remaining to Spend</h3>
                <strong>{trackerRemainingMetric.primary}</strong>
                <small>{trackerRemainingMetric.secondary}</small>
              </article>
              <article className="metric">
                <h3>Next Card Payment (1st)</h3>
                <strong>{dualCurrencyMetric(data.projection.dashboard.nextCardPaymentUsd).primary}</strong>
                <small>{dualCurrencyMetric(data.projection.dashboard.nextCardPaymentUsd).secondary}</small>
              </article>
              <article className="metric">
                <h3>Projected Savings (12M)</h3>
                <strong>{dualCurrencyMetric(savings12mUsd).primary}</strong>
                <small>{dualCurrencyMetric(savings12mUsd).secondary}</small>
              </article>
              <article className="metric">
                <h3>Forecast Accuracy (3M)</h3>
                <strong>{forecastAccuracyPct.toFixed(1)}%</strong>
                <small>Expected vs actual payment deviation</small>
              </article>
            </section>

            <section className="dashboardPanels3">
              <article className="panel">
                <h2>Category Spend (Current Month)</h2>
                <p className="subtle">
                  Total expenses by category for {toMonthLabel(data.projection.currentMonth)}.
                </p>
                {currentMonthCategoryRows.length === 0 ? (
                  <p className="subtle">No categorized expenses in current month yet.</p>
                ) : (
                  <ul className="categoryBars">
                    {currentMonthCategoryRows.slice(0, 8).map((row) => {
                      const pct = currentMonthCategoryMaxUsd > 0 ? Math.max(6, (row.usd / currentMonthCategoryMaxUsd) * 100) : 0;
                      return (
                        <li key={row.category.id}>
                          <div className="categoryBarHeader">
                            <span><CategoryBadge category={row.category} /> {row.category.name}</span>
                            <strong>{dualCurrencyMetric(row.usd).primary}</strong>
                          </div>
                          <div className="categoryBarTrack">
                            <div className="categoryBarFill" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>

              <article className="panel">
                <h2>Most Used Categories (Last 6 Months)</h2>
                <p className="subtle">Sorted by transaction count, then amount.</p>
                {mostUsedCategoryRows.length === 0 ? (
                  <p className="subtle">No recent category data available yet.</p>
                ) : (
                  <>
                    <table className="desktopOnly desktopTable">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Tx Count</th>
                          <th>Total</th>
                          <th>Avg Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mostUsedCategoryRows.map((row) => (
                          <tr key={`most-used-${row.category.id}`}>
                            <td><CategoryBadge category={row.category} /> {row.category.name}</td>
                            <td>{row.count}</td>
                            <td>{dualCurrencyMetric(row.usd).primary}</td>
                            <td>{dualCurrencyMetric(row.avgTicketUsd).primary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mobileOnly">
                      {mostUsedCategoryRows.map((row) => (
                        <article key={`most-used-mobile-${row.category.id}`} className="mobileCard">
                          <h3><CategoryBadge category={row.category} /> {row.category.name}</h3>
                          <p>Tx count: {row.count}</p>
                          <p>Total: {dualCurrencyMetric(row.usd).primary}</p>
                          <p>Avg ticket: {dualCurrencyMetric(row.avgTicketUsd).primary}</p>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </article>

              <article className="panel">
                <h2>Category Deviations</h2>
                <p className="subtle">
                  Current month vs average of the last 3 months.
                </p>
                {categoryDeviationRows.length === 0 ? (
                  <p className="subtle">No category deviation data available yet.</p>
                ) : (
                  <>
                    <table className="desktopOnly desktopTable">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Current</th>
                          <th>Baseline (3M avg)</th>
                          <th>Deviation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryDeviationRows.map((row) => (
                          <tr key={`deviation-${row.category.id}`}>
                            <td><CategoryBadge category={row.category} /> {row.category.name}</td>
                            <td>{dualCurrencyMetric(row.currentUsd).primary}</td>
                            <td>{dualCurrencyMetric(row.baselineUsd).primary}</td>
                            <td className={row.deviationUsd > 0 ? "dashboardBad" : row.deviationUsd < 0 ? "dashboardGood" : ""}>
                              {dualCurrencyMetric(row.deviationUsd).primary}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mobileOnly">
                      {categoryDeviationRows.map((row) => (
                        <article key={`deviation-mobile-${row.category.id}`} className="mobileCard">
                          <h3><CategoryBadge category={row.category} /> {row.category.name}</h3>
                          <p>Current: {dualCurrencyMetric(row.currentUsd).primary}</p>
                          <p>Baseline: {dualCurrencyMetric(row.baselineUsd).primary}</p>
                          <p className={row.deviationUsd > 0 ? "dashboardBad" : row.deviationUsd < 0 ? "dashboardGood" : ""}>
                            Deviation: {dualCurrencyMetric(row.deviationUsd).primary}
                          </p>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </article>
            </section>

            <article className="panel">
              <h2>Cashflow Trend (Current -6 to +6 months)</h2>
              <p className="subtle">X axis: month. Y axis: USD. Hover to inspect exact values. Future segments are dashed.</p>
              <DashboardLineChart
                chartName="Cashflow Trend"
                unitLabel="USD"
                months={dashboardMonths}
                currentMonth={data.projection.currentMonth}
                series={[
                  { label: "Income", color: "#1f6f5f", values: dashboardRows.map((row) => row.incomeUsd) },
                  { label: "Fixed", color: "#b5833b", values: dashboardRows.map((row) => row.fixedExpensesUsd) },
                  { label: "Card Payment", color: "#3467b4", values: dashboardRows.map((row) => row.cardPaymentUsd) },
                  { label: "Net", color: "#8e2419", values: dashboardRows.map((row) => row.netUsd) }
                ]}
                valueFormatter={(value) => formatCodeAmount(value, "USD")}
              />
            </article>

            <article className="panel">
              <h2>Savings Projection (Current -6 to +6 months)</h2>
              <p className="subtle">X axis: month. Y axis: cumulative USD savings. Hover to inspect exact values.</p>
              <DashboardLineChart
                chartName="Savings Projection"
                unitLabel="USD"
                months={dashboardMonths}
                currentMonth={data.projection.currentMonth}
                series={[
                  {
                    label: "Cumulative Savings",
                    color: "#205e4f",
                    values: dashboardRows.map((row) => row.cumulativeSavingsUsd)
                  }
                ]}
                valueFormatter={(value) => formatCodeAmount(value, "USD")}
              />
            </article>

            <article className="panel">
              <h2>Adjustment Drift (Target: 0)</h2>
              <p className="subtle">X axis: month. Y axis: USD. Keep the red line as close to zero as possible.</p>
              <p className={`dashboardDeviationTotal ${adjustmentDriftPct >= 0 ? "dashboardGood" : "dashboardBad"}`}>
                Current: {formatCodeAmount(currentAdjustmentUsd, "USD")} · 6M avg |adj|: {formatCodeAmount(adjustmentAvgAbs6m, "USD")} · Drift: {adjustmentDriftPct >= 0 ? "+" : ""}{adjustmentDriftPct.toFixed(1)}%
              </p>
              <DashboardLineChart
                chartName="Adjustment Drift"
                unitLabel="USD"
                months={dashboardMonths}
                currentMonth={data.projection.currentMonth}
                series={[
                  {
                    label: "Adjustment",
                    color: "#8e2419",
                    values: dashboardRows.map((row) => row.manualAdjustmentUsd)
                  },
                  {
                    label: "Abs Adjustment",
                    color: "#5f6c83",
                    values: dashboardRows.map((row) => Math.abs(row.manualAdjustmentUsd))
                  }
                ]}
                valueFormatter={(value) => formatCodeAmount(value, "USD")}
              />
            </article>

            <section className="dashboardPanels3">
              <article className="panel">
                <h2>Deviation by Source</h2>
                <p className="subtle">
                  Current cycle actual vs expected for payment month {toMonthLabel(data.projection.paymentMonth)}.
                </p>
                <p className={`dashboardDeviationTotal ${totalDeviationUsd > 0 ? "bad" : totalDeviationUsd < 0 ? "good" : ""}`}>
                  Total deviation: {dualCurrencyMetric(totalDeviationUsd).primary}
                </p>
                <table className="desktopTable">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviationRows.map((row) => (
                      <tr key={row.cardId}>
                        <td>{row.cardName}</td>
                        <td>{dualCurrencyMetric(row.expectedCycleUsd).primary}</td>
                        <td>{dualCurrencyMetric(row.currentCycleUsd).primary}</td>
                        <td className={row.deviationUsd > 0 ? "dashboardBad" : row.deviationUsd < 0 ? "dashboardGood" : ""}>
                          {dualCurrencyMetric(row.deviationUsd).primary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="panel">
                <h2>Forecast Risk (Next Month)</h2>
                <p className="subtle">
                  Base from {toMonthLabel(nextMonthKey)} net, adjusted by last 6 closed-month deviation behavior.
                </p>
                <ul className="dashboardRiskList">
                  <li>
                    <span>Worst case</span>
                    <strong>{dualCurrencyMetric(nextMonthRiskWorstUsd).primary}</strong>
                  </li>
                  <li>
                    <span>Base case</span>
                    <strong>{dualCurrencyMetric(nextMonthRiskBaseUsd).primary}</strong>
                  </li>
                  <li>
                    <span>Best case</span>
                    <strong>{dualCurrencyMetric(nextMonthRiskBestUsd).primary}</strong>
                  </li>
                </ul>
              </article>

              <article className="panel">
                <h2>FX Impact (ARS Equivalent)</h2>
                <p className="subtle">
                  Set a scenario rate to instantly evaluate impact on current-month expenses and net.
                </p>
                <div className="dashboardFxInputRow">
                  <label className="fieldLabel">
                    <span>Scenario ARS/USD</span>
                    <input
                      type="number"
                      step="0.01"
                      value={fxScenarioRateInput}
                      onChange={(event) => setFxScenarioRateInput(event.target.value)}
                      placeholder={currentRate.toFixed(2)}
                    />
                  </label>
                </div>
                <ul className="dashboardRiskList">
                  <li>
                    <span>Total Expenses (USD)</span>
                    <strong>{USD_FORMAT.format(currentExpensesUsd)}</strong>
                  </li>
                  <li>
                    <span>Expenses ARS (Base {currentRate.toFixed(2)})</span>
                    <strong>{ARS_FORMAT.format(fxExpensesBaseArs)}</strong>
                  </li>
                  <li>
                    <span>Expenses ARS (Scenario {fxScenarioRate.toFixed(2)})</span>
                    <strong>{ARS_FORMAT.format(fxExpensesScenarioArs)}</strong>
                  </li>
                  <li>
                    <span>Impact on Expenses (Scenario - Base)</span>
                    <strong className={fxExpensesDeltaArs > 0 ? "dashboardBad" : fxExpensesDeltaArs < 0 ? "dashboardGood" : ""}>
                      {ARS_FORMAT.format(fxExpensesDeltaArs)}
                    </strong>
                  </li>
                  <li>
                    <span>Net ARS (Base {currentRate.toFixed(2)})</span>
                    <strong>{ARS_FORMAT.format(fxNetBaseArs)}</strong>
                  </li>
                  <li>
                    <span>Net ARS (Scenario {fxScenarioRate.toFixed(2)})</span>
                    <strong>{ARS_FORMAT.format(fxNetScenarioArs)}</strong>
                  </li>
                  <li>
                    <span>Impact on Net (Scenario - Base)</span>
                    <strong className={fxNetDeltaArs > 0 ? "dashboardGood" : fxNetDeltaArs < 0 ? "dashboardBad" : ""}>
                      {ARS_FORMAT.format(fxNetDeltaArs)}
                    </strong>
                  </li>
                  <li>
                    <span>Reference: Expenses ARS (-10% / +10%)</span>
                    <strong>{ARS_FORMAT.format(fxExpensesDownArs)} / {ARS_FORMAT.format(fxExpensesUpArs)}</strong>
                  </li>
                  <li>
                    <span>Reference: Net ARS (-10% / +10%)</span>
                    <strong>{ARS_FORMAT.format(fxNetDownArs)} / {ARS_FORMAT.format(fxNetUpArs)}</strong>
                  </li>
                </ul>
              </article>
            </section>
          </section>
        )}

        {activeTab === "tracker" && (
          <section className="panel">
            <h2>
              Current Spending Cycle ({toMonthLabel(data.projection.currentMonth)}) · Paid on 1st of {toMonthLabel(data.projection.paymentMonth)}
            </h2>
            <p className="subtle">Expected values are tied to payment month. FX reference: {data.projection.currentRateArsPerUsd.toFixed(2)} ARS/USD.</p>
            <article className="trackerTotalHero">
              <h3>Total Remaining to Spend</h3>
              <strong>{trackerRemainingMetric.primary}</strong>
              <small>{trackerRemainingMetric.secondary}</small>
            </article>
            <table className="desktopOnly desktopTable forecastTable">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Remaining</th>
                  <th>Expected Payment Month</th>
                  <th>Current Spending</th>
                  <th>Last Expense</th>
                </tr>
              </thead>
              <tbody>
                {data.projection.cardTracker.map((row) => (
                  <tr key={row.cardId} className={`trackerRow tracker-${trackerStatus(row)}`}>
                    <td>
                      <span className="trackerName">
                        <SourceBadge sourceType={data.cards.find((card) => card.id === row.cardId)?.sourceType} />
                        {row.cardName}
                      </span>
                      <span className={`trackerBadge tracker-${trackerStatus(row)}`}>
                        {trackerStatus(row) === "over" ? "Over limit" : trackerStatus(row) === "warning" ? "Near limit" : trackerStatus(row) === "ok" ? "Healthy" : "No target"}
                      </span>
                    </td>
                    <td className={`trackerRemaining tracker-${trackerStatus(row)}`}>
                      {row.expectedCycleUsd <= 0 ? (
                        <span className="subtle">No tracking target</span>
                      ) : (
                        displayCurrency === "USD" ? USD_FORMAT.format(row.remainingExpectedUsd) : ARS_FORMAT.format(row.remainingExpectedArs)
                      )}
                    </td>
                    <td>{displayCurrency === "USD" ? USD_FORMAT.format(row.expectedCycleUsd) : ARS_FORMAT.format(row.expectedCycleArs)}</td>
                    <td>{displayCurrency === "USD" ? USD_FORMAT.format(row.currentCycleUsd) : ARS_FORMAT.format(row.currentCycleArs)}</td>
                    <td>{toLocalDateTimeLabel(row.lastExpenseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mobileOnly">
              {data.projection.cardTracker.map((row) => (
                <article key={row.cardId} className={`mobileCard tracker-${trackerStatus(row)}`}>
                  <h3><SourceBadge sourceType={data.cards.find((card) => card.id === row.cardId)?.sourceType} /> {row.cardName}</h3>
                  <p className={`trackerBadge tracker-${trackerStatus(row)}`}>
                    {trackerStatus(row) === "over" ? "Over limit" : trackerStatus(row) === "warning" ? "Near limit" : trackerStatus(row) === "ok" ? "Healthy margin" : "No target"}
                  </p>
                  {row.expectedCycleUsd <= 0 ? (
                    <p className="mobileMain tracker-none">No tracking target</p>
                  ) : (
                    <>
                      <p className={`mobileMain trackerRemaining tracker-${trackerStatus(row)}`}>
                        {displayCurrency === "USD" ? USD_FORMAT.format(row.remainingExpectedUsd) : ARS_FORMAT.format(row.remainingExpectedArs)}
                      </p>
                      <p className="subtle">Remaining to spend</p>
                    </>
                  )}
                  <details>
                    <summary>Details</summary>
                    <p>Expected: {displayCurrency === "USD" ? USD_FORMAT.format(row.expectedCycleUsd) : ARS_FORMAT.format(row.expectedCycleArs)}</p>
                    <p>Current spending: {displayCurrency === "USD" ? USD_FORMAT.format(row.currentCycleUsd) : ARS_FORMAT.format(row.currentCycleArs)}</p>
                    <p>Last expense: {toLocalDateTimeLabel(row.lastExpenseDate)}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "expenses" && (
          <section className="stack">
            <article className="panel">
              <h2>Add Expense</h2>
              <form className="formGrid" onSubmit={submitExpense}>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(event) => {
                    setExpenseDateTouched(true);
                    setExpenseForm((prev) => ({ ...prev, date: event.target.value }));
                  }}
                  required
                />
                <select value={expenseForm.cardId} onChange={(event) => setExpenseForm((prev) => ({ ...prev, cardId: event.target.value }))} required>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                <select value={expenseForm.categoryId} onChange={(event) => handleExpenseCategorySelect(event.target.value)}>
                  <option value="">No category</option>
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {expenseCategorySelectLabel(category.emoji, category.name)}
                    </option>
                  ))}
                  <option value={CREATE_CATEGORY_OPTION}>+ Create category...</option>
                </select>
                <input type="number" step="0.01" placeholder="Amount" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={expenseForm.currency} onChange={(event) => setExpenseForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input placeholder="Description (optional)" value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} />
                <button type="submit">Save Expense</button>
              </form>
              {showQuickCategoryForm ? (
                <form className="inlineForm quickCategoryCreate" onSubmit={submitQuickCategory}>
                  <input
                    placeholder="New category name"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                  <select
                    value={categoryForm.emoji}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, emoji: event.target.value }))}
                  >
                    {EXPENSE_CATEGORY_EMOJI_OPTIONS.map((emoji) => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                  <select
                    value={categoryForm.iconKey}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, iconKey: event.target.value as ExpenseCategoryIconKey }))}
                  >
                    {EXPENSE_CATEGORY_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="submit">Create and use</button>
                  <button type="button" className="secondary" onClick={() => setShowQuickCategoryForm(false)}>Cancel</button>
                </form>
              ) : null}
            </article>

            <article className="panel">
              <h2>Expense Log</h2>
              <div className="filters">
                <select value={expenseFilterCard} onChange={(event) => setExpenseFilterCard(event.target.value)}>
                  <option value="all">All sources</option>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                {expenseFilterCard === "all" ? (
                  <p className="subtle sourcePreview"><span className="sourceBadge sourceType-other">All Sources</span></p>
                ) : findCardById(data.cards, expenseFilterCard) ? (
                  <p className="subtle sourcePreview">
                    <SourceBadge sourceType={findCardById(data.cards, expenseFilterCard)?.sourceType} />
                  </p>
                ) : null}
                <select value={expenseFilterCategory} onChange={(event) => setExpenseFilterCategory(event.target.value)}>
                  <option value="all">All categories</option>
                  <option value={UNCATEGORIZED_FILTER_OPTION}>Uncategorized</option>
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {expenseCategorySelectLabel(category.emoji, category.name)}
                    </option>
                  ))}
                </select>
                <select value={expenseTimeFilter} onChange={(event) => setExpenseTimeFilter(event.target.value as ExpenseTimeFilter)}>
                  {EXPENSE_TIME_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {expenseTimeFilter === "CUSTOM_MONTH" ? (
                  <input type="month" value={expenseCustomMonth} onChange={(event) => setExpenseCustomMonth(event.target.value)} />
                ) : null}
              </div>
              <table className="desktopOnly desktopTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      cards={data.cards}
                      categories={sortedCategories}
                      expenseDisplayMode={expenseDisplayMode}
                      getArsPerUsdForDate={getArsPerUsdForDate}
                      isEditing={editingExpenseId === expense.id}
                      onStartEdit={() => setEditingExpenseId(expense.id)}
                      onCancelEdit={() => setEditingExpenseId(null)}
                      onSave={updateExpense}
                      onDelete={deleteExpense}
                    />
                  ))}
                </tbody>
              </table>
              <div className="mobileOnly">
                {filteredExpenses.map((expense) => (
                  <MobileExpenseCard
                    key={expense.id}
                    expense={expense}
                    cards={data.cards}
                    categories={sortedCategories}
                    expenseDisplayMode={expenseDisplayMode}
                    getArsPerUsdForDate={getArsPerUsdForDate}
                    onSave={updateExpense}
                    onDelete={deleteExpense}
                  />
                ))}
              </div>
            </article>
          </section>
        )}

        {activeTab === "forecast" && (
          <section className="panel">
            <h2>Financial Forecast ({data.projection.rows.length} months)</h2>
            <p className="subtle">Shows full current year by default (Jan to Dec). Load previous/next in chunks of 3. Adjustment is editable only for current and previous month.</p>
            {forecastWindow.canLoadPrev || forecastWindow.canLoadNext ? (
              <div className="forecastActions">
                {forecastWindow.canLoadPrev ? (
                  <button className="secondary" onClick={() => setVisiblePastMonths((prev) => prev + 3)}>Load previous</button>
                ) : null}
                {forecastWindow.canLoadNext ? (
                  <button className="secondary" onClick={() => setVisibleFutureMonths((prev) => prev + 3)}>Load next</button>
                ) : null}
              </div>
            ) : null}
            <table className="desktopOnly desktopTable">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Fixed</th>
                  <th>Card Payment</th>
                  <th>Advancement Impact</th>
                  <th>Adjustment (USD)</th>
                  <th>Total Expenses</th>
                  <th>Net</th>
                  <th>Savings</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {forecastWindow.rows.map((row) => {
                  const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);
                  const editable = editableMonths.has(row.month);
                  return (
                    <tr key={row.month} className={row.month === data.projection.currentMonth ? "currentMonthRow" : ""}>
                      <td>
                        {toMonthLabel(row.month)}
                        {row.month === data.projection.currentMonth ? <span className="currentCycleBadge">Current cycle</span> : null}
                      </td>
                      <td>{formatMoney(row.incomeUsd, row.month)}</td>
                      <td>{formatMoney(row.fixedExpensesUsd, row.month)}</td>
                      <td>{formatMoney(row.cardPaymentUsd, row.month)}</td>
                      <td>{formatMoney(row.advancementImpactUsd, row.month)}</td>
                      <td>
                        {editable ? (
                          <input
                            type="number"
                            step="0.01"
                            value={adjustmentDrafts[row.month] ?? ""}
                            onChange={(event) => setAdjustmentDrafts((prev) => ({ ...prev, [row.month]: event.target.value }))}
                            placeholder="0"
                          />
                        ) : (
                          USD_FORMAT.format(row.previewAdjustmentUsd)
                        )}
                      </td>
                      <td>{formatMoney(row.totalExpensesUsd, row.month)}</td>
                      <td>{formatMoney(row.previewNetUsd, row.month)}</td>
                      <td>{formatMoney(row.previewSavingsUsd, row.month)}</td>
                      <td>{editable ? <button className="tiny" onClick={() => void saveAdjustment(row.month)}>Save</button> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mobileOnly">
              {forecastWindow.rows.map((row) => {
                const editableMonths = new Set([data.projection.currentMonth, shiftMonth(data.projection.currentMonth, -1)]);
                const editable = editableMonths.has(row.month);
                return (
                  <article key={row.month} className={`mobileCard ${row.month === data.projection.currentMonth ? "currentMonthCard" : ""}`}>
                    <h3>
                      {toMonthLabel(row.month)}
                      {row.month === data.projection.currentMonth ? <span className="currentCycleBadge">Current cycle</span> : null}
                    </h3>
                    <p className="mobileMain">{formatMoney(row.previewNetUsd, row.month)}</p>
                    <p className="subtle">Net for month</p>
                    <details>
                      <summary>Income / Expenses</summary>
                      <p>Income: {formatMoney(row.incomeUsd, row.month)}</p>
                      <p>Fixed: {formatMoney(row.fixedExpensesUsd, row.month)}</p>
                      <p>Card payment: {formatMoney(row.cardPaymentUsd, row.month)}</p>
                      <p>Advancement: {formatMoney(row.advancementImpactUsd, row.month)}</p>
                      <p>Total expenses: {formatMoney(row.totalExpensesUsd, row.month)}</p>
                      <p>Savings: {formatMoney(row.previewSavingsUsd, row.month)}</p>
                    </details>
                    {editable ? (
                      <div className="mobileInline">
                        <input
                          type="number"
                          step="0.01"
                          value={adjustmentDrafts[row.month] ?? ""}
                          onChange={(event) => setAdjustmentDrafts((prev) => ({ ...prev, [row.month]: event.target.value }))}
                          placeholder="Adjustment USD"
                        />
                        <button className="tiny" onClick={() => void saveAdjustment(row.month)}>Save</button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="stack">
            <article className="panel settingsCategories">
              <h2>Expense Categories</h2>
              <details className="itemAccordion">
                <summary>
                  <span>Manage Categories</span>
                  <span className="subtle">{sortedCategories.length} total</span>
                </summary>
                <form className="formGrid" onSubmit={submitCategory}>
                  <input
                    placeholder="Category name"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                  <select
                    value={categoryForm.emoji}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, emoji: event.target.value }))}
                  >
                    {EXPENSE_CATEGORY_EMOJI_OPTIONS.map((emoji) => (
                      <option key={emoji} value={emoji}>{emoji}</option>
                    ))}
                  </select>
                  <select
                    value={categoryForm.iconKey}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, iconKey: event.target.value as ExpenseCategoryIconKey }))}
                  >
                    {EXPENSE_CATEGORY_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="submit">Add Category</button>
                </form>
                <ul className="accordionList">
                  {sortedCategories.map((category) => (
                    <li key={category.id} className="listRow">
                      <span>
                        <CategoryBadge category={category} /> {category.name}
                      </span>
                      {category.isDefault ? (
                        <span className="subtle">Default</span>
                      ) : (
                        <EditableCategoryRow
                          category={category}
                          isEditing={editingCategoryId === category.id}
                          onEdit={() => setEditingCategoryId(category.id)}
                          onCancel={() => setEditingCategoryId(null)}
                          onSave={updateCategory}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </article>

            <article className="panel settingsAccount">
              <h2>Account Security</h2>
              <form className="formGrid" onSubmit={submitPasswordChange}>
                <input
                  type="password"
                  placeholder="New password"
                  value={passwordForm}
                  onChange={(event) => setPasswordForm(event.target.value)}
                  required
                />
                <button type="submit">Update Password</button>
              </form>
              {passwordFeedback ? <p className="subtle">{passwordFeedback}</p> : null}
            </article>

            <article className="panel settingsCards">
              <h2>Expense Sources</h2>
              <form className="formGrid" onSubmit={submitCard}>
                <input placeholder="Source name" value={cardForm.name} onChange={(event) => setCardForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <select value={cardForm.currency} onChange={(event) => setCardForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <select value={cardForm.sourceType} onChange={(event) => setCardForm((prev) => ({ ...prev, sourceType: event.target.value as SourceType }))}>
                  {SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
                  ))}
                </select>
                <button type="submit">Add Source</button>
              </form>
              <ul className="accordionList">
                {data.cards.map((card) => (
                  <details key={card.id} className="itemAccordion">
                    <summary>
                      <span><SourceBadge sourceType={card.sourceType} /> {card.name}</span>
                      <span className="subtle">{sourceTypeLabel(card.sourceType)} · {card.currency} · {card.isActive ? "active" : "inactive"}</span>
                    </summary>
                    <ul>
                      <EditableCardRow
                        card={card}
                        isEditing={editingCardId === card.id}
                        onEdit={() => setEditingCardId(card.id)}
                        onCancel={() => setEditingCardId(null)}
                        onSave={updateCard}
                        onToggle={() => void toggleCard(card)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsIncome">
              <h2>Income Sources</h2>
              <form className="formGrid" onSubmit={submitIncome}>
                <input placeholder="Income name" value={incomeForm.name} onChange={(event) => setIncomeForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Amount" value={incomeForm.amount} onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={incomeForm.currency} onChange={(event) => setIncomeForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <label className="fieldLabel"><span>Start month</span><input type="month" value={incomeForm.startMonth} onChange={(event) => setIncomeForm((prev) => ({ ...prev, startMonth: event.target.value }))} required /></label>
                <label className="fieldLabel"><span>End month</span><input type="month" value={incomeForm.endMonth} onChange={(event) => setIncomeForm((prev) => ({ ...prev, endMonth: event.target.value }))} /></label>
                <button type="submit">Add Income</button>
              </form>
              <ul className="accordionList">
                {sortedIncomes.map((income) => (
                  <details key={income.id} className="itemAccordion">
                    <summary>
                      <span>{income.name}</span>
                      <span className="subtle">{income.amount} {income.currency}</span>
                    </summary>
                    <ul>
                      <EditableIncomeRow
                        income={income}
                        isEditing={editingIncomeId === income.id}
                        onEdit={() => setEditingIncomeId(income.id)}
                        onCancel={() => setEditingIncomeId(null)}
                        onSave={updateIncome}
                        onToggle={() => void toggleIncome(income)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsFixed">
              <h2>Fixed Expenses</h2>
              <form className="formGrid" onSubmit={submitFixed}>
                <input placeholder="Expense name" value={fixedForm.name} onChange={(event) => setFixedForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input type="number" step="0.01" placeholder="Amount" value={fixedForm.amount} onChange={(event) => setFixedForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={fixedForm.currency} onChange={(event) => setFixedForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <label className="fieldLabel"><span>Start month</span><input type="month" value={fixedForm.startMonth} onChange={(event) => setFixedForm((prev) => ({ ...prev, startMonth: event.target.value }))} required /></label>
                <label className="fieldLabel"><span>End month</span><input type="month" value={fixedForm.endMonth} onChange={(event) => setFixedForm((prev) => ({ ...prev, endMonth: event.target.value }))} /></label>
                <button type="submit">Add Fixed</button>
              </form>
              <ul className="accordionList">
                {sortedFixedExpenses.map((fixed) => (
                  <details key={fixed.id} className="itemAccordion">
                    <summary>
                      <span>{fixed.name}</span>
                      <span className="subtle">{fixed.amount} {fixed.currency}</span>
                    </summary>
                    <ul>
                      <EditableFixedRow
                        item={fixed}
                        isEditing={editingFixedId === fixed.id}
                        onEdit={() => setEditingFixedId(fixed.id)}
                        onCancel={() => setEditingFixedId(null)}
                        onSave={updateFixed}
                        onToggle={() => void toggleFixed(fixed)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsExpectations">
              <h2>Expected Source Spending (Payment Month)</h2>
              <form className="formGrid" onSubmit={submitExpectation}>
                <select value={expectationForm.cardId} onChange={(event) => setExpectationForm((prev) => ({ ...prev, cardId: event.target.value }))} required>
                  {data.cards.map((card) => (
                    <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
                  ))}
                </select>
                <label className="fieldLabel"><span>Payment month</span><input type="month" value={expectationForm.month} onChange={(event) => setExpectationForm((prev) => ({ ...prev, month: event.target.value }))} required /></label>
                <input type="number" step="0.01" placeholder="Expected amount" value={expectationForm.amount} onChange={(event) => setExpectationForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={expectationForm.currency} onChange={(event) => setExpectationForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input type="number" min="1" max="36" placeholder="Repeat N months" value={expectationForm.repeatMonths} onChange={(event) => setExpectationForm((prev) => ({ ...prev, repeatMonths: event.target.value }))} />
                <button type="submit">Save Expectation</button>
              </form>
              {expectationGroups.length === 0 ? (
                <p className="subtle">No current/future expectations yet.</p>
              ) : (
                <div className="expectationAccordionStack">
                  {expectationGroups.map((group) => (
                    <details key={group.card.id} className="expectationAccordion">
                      <summary>
                        <span><SourceBadge sourceType={group.card.sourceType} /> {group.card.name}</span>
                        <span className="subtle">{group.rows.length} month{group.rows.length === 1 ? "" : "s"}</span>
                      </summary>
                      <ul className="accordionList">
                        {group.rows.map((row) => (
                          <details key={row.id} className="itemAccordion">
                            <summary>
                              <span>{toMonthLabel(row.month)}</span>
                              <span className="subtle">{row.amount} {row.currency}</span>
                            </summary>
                            <ul>
                              <EditableExpectationRow
                                row={row}
                                cards={data.cards}
                                isEditing={editingExpectationId === row.id}
                                onEdit={() => setEditingExpectationId(row.id)}
                                onCancel={() => setEditingExpectationId(null)}
                                onSave={updateExpectation}
                                onDelete={() => void deleteExpectation(row.id)}
                              />
                            </ul>
                          </details>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </article>

            <article className="panel settingsAdvancements">
              <h2>Advancements (Affect Next Month)</h2>
              <form className="formGrid" onSubmit={submitAdvancement}>
                <label className="fieldLabel"><span>Advancement month</span><input type="month" value={advancementForm.month} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, month: event.target.value }))} required /></label>
                <input type="number" step="0.01" placeholder="Amount" value={advancementForm.amount} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                <select value={advancementForm.currency} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input placeholder="Note (optional)" value={advancementForm.note} onChange={(event) => setAdvancementForm((prev) => ({ ...prev, note: event.target.value }))} />
                <button type="submit">Add Advancement</button>
              </form>
              <ul className="accordionList">
                {sortedAdvancements.map((row) => (
                  <details key={row.id} className="itemAccordion">
                    <summary>
                      <span>{toMonthLabel(row.month)}</span>
                      <span className="subtle">{row.amount} {row.currency}</span>
                    </summary>
                    <ul>
                      <EditableAdvancementRow
                        row={row}
                        isEditing={editingAdvancementId === row.id}
                        onEdit={() => setEditingAdvancementId(row.id)}
                        onCancel={() => setEditingAdvancementId(null)}
                        onSave={updateAdvancement}
                        onToggle={() => void updateAdvancement({ id: row.id, isActive: !row.isActive })}
                        onDelete={() => void deleteAdvancement(row.id)}
                      />
                    </ul>
                  </details>
                ))}
              </ul>
            </article>

            <article className="panel settingsExchange">
              <h2>Exchange Rate (ARS per USD)</h2>
              <p className="subtle">
                Rates are scoped per user. Need reference values?{" "}
                <a href="https://www.dolarito.ar/" target="_blank" rel="noreferrer">
                  Check rates on Dolarito
                </a>.
              </p>
              {showMissingFxWarning ? (
                <p className="subtle fxInlineWarning">
                  No exchange rate configured for this user yet.
                </p>
              ) : null}
              {showStaleFxWarning ? (
                <p className="subtle fxInlineWarning">
                  Latest rate ({fxStatus.lastUpdatedDate}) is older than {fxStatus.staleAfterDays} days.
                </p>
              ) : null}
              <form className="formGrid" onSubmit={submitRate}>
                <input type="date" value={rateForm.date} onChange={(event) => setRateForm((prev) => ({ ...prev, date: event.target.value }))} required />
                <input type="number" step="0.000001" placeholder="ARS per USD" value={rateForm.arsPerUsd} onChange={(event) => setRateForm((prev) => ({ ...prev, arsPerUsd: event.target.value }))} required />
                <button type="submit">{editingRateId ? "Update Rate" : "Save Rate"}</button>
                {editingRateId ? (
                  <button type="button" className="secondary" onClick={cancelEditRate}>Cancel Edit</button>
                ) : null}
                <button type="button" className="secondary" onClick={() => void syncRate()}>Fetch from API</button>
              </form>
              {editingRateId && rateForm.date.slice(0, 7) < data.projection.currentMonth ? (
                <p className="subtle fxInlineWarning">
                  Warning: you are editing a past-month FX value. Historical totals for that month will be recalculated.
                </p>
              ) : null}
              <ul className="accordionList">
                {sortedExchangeRates.map((rate) => (
                  <details key={rate.id} className="itemAccordion">
                    <summary>
                      <span>{rate.date}</span>
                      <span className="subtle">{rate.arsPerUsd.toFixed(4)}</span>
                    </summary>
                    <div className="listRow">
                      <span>Source: {rate.source ?? "manual"}</span>
                      <button type="button" className="secondary" onClick={() => startEditRate(rate)}>Edit</button>
                    </div>
                  </details>
                ))}
              </ul>
            </article>
          </section>
        )}
      </div>
      <nav className="bottomTabs mobileOnly">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => {
              triggerHaptic();
              setActiveTab(tab.id);
            }}
          >
            <span className="bottomTabIcon" aria-hidden>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function ExpenseRow({ expense, cards, categories, expenseDisplayMode, getArsPerUsdForDate, isEditing, onStartEdit, onCancelEdit, onSave, onDelete }: {
  expense: Expense;
  cards: Card[];
  categories: ExpenseCategory[];
  expenseDisplayMode: ExpenseDisplayMode;
  getArsPerUsdForDate: (dateLike: string) => number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (expense: Expense, originalExpense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Expense>({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  const arsPerUsd = getArsPerUsdForDate(expense.date);
  const targetCurrency = expenseDisplayMode === "STORED" ? expense.currency : expenseDisplayMode;
  const convertedAmount =
    targetCurrency === expense.currency
      ? expense.amount
      : expense.currency === "USD"
        ? expense.amount * arsPerUsd
        : expense.amount / arsPerUsd;
  const mainLabel = targetCurrency === "USD" ? USD_FORMAT.format(convertedAmount) : ARS_FORMAT.format(convertedAmount);
  const originalLabel = formatCodeAmount(expense.amount, expense.currency);
  const showOriginal = expenseDisplayMode !== "STORED";

  useEffect(() => {
    setDraft({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  }, [expense]);

  if (isEditing) {
    return (
      <tr>
        <td><input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} /></td>
        <td><select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>{cards.map((card) => <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>)}</select></td>
        <td>
          <select
            value={draft.categoryId ?? ""}
            onChange={(event) => {
              const categoryId = event.target.value || null;
              setDraft((prev) => ({
                ...prev,
                categoryId,
                category: findCategoryById(categories, categoryId) ?? null
              }));
            }}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{expenseCategorySelectLabel(category.emoji, category.name)}</option>
            ))}
          </select>
        </td>
        <td><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /></td>
        <td><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select></td>
        <td><input value={draft.description ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} /></td>
        <td className="rowButtons"><button onClick={() => void onSave(draft, expense)}>Save</button><button className="secondary" onClick={onCancelEdit}>Cancel</button></td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{toLocalDateTimeLabel(expense.date)}</td>
      <td><SourceBadge sourceType={expense.card.sourceType} /> {expense.card.name}</td>
      <td>
        {expense.category ? (
          <span className="categoryNameCell">
            <CategoryBadge category={expense.category} /> {expense.category.name}
          </span>
        ) : (
          <span className="subtle">-</span>
        )}
      </td>
      <td>
        <div className="amountCell">
          <span>{mainLabel}</span>
          {showOriginal ? <small className="subtle">Real: {originalLabel}</small> : null}
        </div>
      </td>
      <td>{expense.currency}</td>
      <td>{expense.description || "-"}</td>
      <td className="rowButtons"><button onClick={onStartEdit}>Edit</button><button className="secondary" onClick={() => void onDelete(expense.id)}>Delete</button></td>
    </tr>
  );
}

function MobileExpenseCard({
  expense,
  cards,
  categories,
  expenseDisplayMode,
  getArsPerUsdForDate,
  onSave,
  onDelete
}: {
  expense: Expense;
  cards: Card[];
  categories: ExpenseCategory[];
  expenseDisplayMode: ExpenseDisplayMode;
  getArsPerUsdForDate: (dateLike: string) => number;
  onSave: (expense: Expense, originalExpense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Expense>({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  const arsPerUsd = getArsPerUsdForDate(expense.date);
  const targetCurrency = expenseDisplayMode === "STORED" ? expense.currency : expenseDisplayMode;
  const convertedAmount =
    targetCurrency === expense.currency
      ? expense.amount
      : expense.currency === "USD"
        ? expense.amount * arsPerUsd
        : expense.amount / arsPerUsd;
  const mainLabel = targetCurrency === "USD" ? USD_FORMAT.format(convertedAmount) : ARS_FORMAT.format(convertedAmount);
  const originalLabel = formatCodeAmount(expense.amount, expense.currency);
  const showOriginal = expenseDisplayMode !== "STORED";

  useEffect(() => {
    setDraft({ ...expense, date: toLocalExpenseDateKey(expense.date) });
  }, [expense]);

  if (isEditing) {
    return (
      <article className="mobileCard">
        <h3>Edit Expense</h3>
        <div className="mobileInline">
          <input type="date" value={draft.date} onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))} />
          <select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>
            ))}
          </select>
          <select
            value={draft.categoryId ?? ""}
            onChange={(event) => {
              const categoryId = event.target.value || null;
              setDraft((prev) => ({
                ...prev,
                categoryId,
                category: findCategoryById(categories, categoryId) ?? null
              }));
            }}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{expenseCategorySelectLabel(category.emoji, category.name)}</option>
            ))}
          </select>
          <input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} />
          <select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
          <input value={draft.description ?? ""} placeholder="Description" onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} />
          <button onClick={() => void onSave(draft, expense).then(() => setIsEditing(false))}>Save</button>
          <button className="secondary" onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </article>
    );
  }

  return (
    <article className="mobileCard">
      <h3><SourceBadge sourceType={expense.card.sourceType} /> {expense.card.name}</h3>
      <p className="mobileMain">{mainLabel}</p>
      {showOriginal ? <p className="subtle">Real: {originalLabel}</p> : null}
      <p className="subtle">{expense.category ? <><CategoryBadge category={expense.category} /> {expense.category.name}</> : "Category: -"}</p>
      <p className="subtle">Currency: {expense.currency}</p>
      <p className="subtle">{toLocalDateTimeLabel(expense.date)}</p>
      <details>
        <summary>Details</summary>
        <p>Description: {expense.description || "-"}</p>
      </details>
      <div className="rowButtons">
        <button onClick={() => setIsEditing(true)}>Edit</button>
        <button className="secondary" onClick={() => void onDelete(expense.id)}>Delete</button>
      </div>
    </article>
  );
}

function DashboardLineChart({
  chartName,
  unitLabel,
  months,
  currentMonth,
  series,
  valueFormatter
}: {
  chartName: string;
  unitLabel: string;
  months: string[];
  currentMonth: string;
  series: Array<{ label: string; color: string; values: number[] }>;
  valueFormatter?: (value: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (months.length === 0 || series.length === 0) {
    return <p className="subtle">No chart data available.</p>;
  }

  const width = 980;
  const height = 260;
  const padLeft = 26;
  const padRight = 18;
  const padTop = 14;
  const padBottom = 34;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const allValues = series.flatMap((item) => item.values);
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const range = maxValue - minValue || 1;
  const currentIndex = months.findIndex((month) => month === currentMonth);
  const activeIndex = hoveredIndex ?? currentIndex;
  const formatValue = valueFormatter ?? ((value: number) => `${value.toFixed(2)} ${unitLabel}`);

  const xFor = (index: number) =>
    padLeft + (months.length <= 1 ? chartWidth / 2 : (index / (months.length - 1)) * chartWidth);
  const yFor = (value: number) => padTop + ((maxValue - value) / range) * chartHeight;
  const pointsForRange = (values: number[], start: number, end: number) => {
    if (end < start || start < 0 || end >= values.length) return "";
    const points: string[] = [];
    for (let i = start; i <= end; i += 1) {
      points.push(`${xFor(i)},${yFor(values[i])}`);
    }
    return points.join(" ");
  };

  const xTicks = months
    .map((month, index) => ({ month, index }))
    .filter(({ month, index }) => index % 2 === 0 || month === currentMonth || index === months.length - 1);

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const normalizedX = Math.max(0, Math.min(chartWidth, svgX - padLeft));
    const index =
      months.length <= 1 ? 0 : Math.round((normalizedX / chartWidth) * (months.length - 1));
    setHoveredIndex(Math.max(0, Math.min(months.length - 1, index)));
  }

  const activeMonth = activeIndex >= 0 ? months[activeIndex] : null;

  return (
    <div className="dashboardChartWrap">
      <div className="dashboardChartMeta">
        <span>{chartName}</span>
        <span>Unit: {unitLabel}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="dashboardChartSvg"
        aria-label={`${chartName} (${unitLabel})`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = padTop + (tick / 4) * chartHeight;
          return <line key={tick} x1={padLeft} x2={width - padRight} y1={y} y2={y} className="dashboardGridLine" />;
        })}
        {currentIndex >= 0 ? (
          <line
            x1={xFor(currentIndex)}
            x2={xFor(currentIndex)}
            y1={padTop}
            y2={height - padBottom}
            className="dashboardCurrentLine"
          />
        ) : null}
        {hoveredIndex !== null ? (
          <line
            x1={xFor(hoveredIndex)}
            x2={xFor(hoveredIndex)}
            y1={padTop}
            y2={height - padBottom}
            className="dashboardHoverLine"
          />
        ) : null}
        {series.map((item) => {
          const values = item.values;
          const pastEnd = currentIndex >= 0 ? currentIndex : values.length - 1;
          const pastPoints = pointsForRange(values, 0, Math.max(0, pastEnd));
          const futurePoints = pointsForRange(values, Math.max(0, pastEnd), values.length - 1);
          const markerIndex =
            activeIndex >= 0 && activeIndex < values.length
              ? activeIndex
              : currentIndex >= 0 && currentIndex < values.length
                ? currentIndex
                : null;

          return (
            <g key={item.label}>
              <polyline points={pastPoints} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {values.length > 1 && currentIndex >= 0 && currentIndex < values.length - 1 ? (
                <polyline
                  points={futurePoints}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.82"
                />
              ) : null}
              {markerIndex !== null ? (
                <circle cx={xFor(markerIndex)} cy={yFor(values[markerIndex])} r="4.5" fill={item.color} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {activeMonth ? (
        <div className="dashboardTooltip">
          <div className="dashboardTooltipMonth">{toMonthLabel(activeMonth)}</div>
          {series.map((item) => {
            const value = item.values[activeIndex] ?? 0;
            return (
              <div key={`${activeMonth}-${item.label}`} className="dashboardTooltipRow">
                <span>
                  <i style={{ background: item.color }} />
                  {item.label}
                </span>
                <strong>{formatValue(value)}</strong>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="dashboardLegend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="dashboardXAxis">
        {xTicks.map(({ month, index }) => (
          <span key={`${month}-${index}`} className={month === currentMonth ? "active" : ""}>
            {toMonthLabel(month)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategoryGlyph({ iconKey, className }: { iconKey: ExpenseCategoryIconKey | string; className?: string }) {
  const safeIconKey = EXPENSE_CATEGORY_ICON_OPTIONS.some((option) => option.value === iconKey)
    ? iconKey
    : "custom";
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden>
      {safeIconKey === "basket" ? (
        <>
          <path d="M3 6.3h10l-1 6.2H4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.2 6.3l2-2.6M10.8 6.3l-2-2.6" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "meal" ? (
        <>
          <line x1="5" y1="3" x2="5" y2="13" stroke="currentColor" strokeWidth="1.2" />
          <line x1="7.2" y1="3" x2="7.2" y2="13" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10 3v4.2a1.6 1.6 0 0 0 3.2 0V3" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "transport" ? (
        <>
          <rect x="2.2" y="5" width="11.6" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5.1" cy="11.4" r="1.2" fill="currentColor" />
          <circle cx="10.9" cy="11.4" r="1.2" fill="currentColor" />
        </>
      ) : null}
      {safeIconKey === "shopping" ? (
        <>
          <path d="M4 5.3h8l-1 7H5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 5.3V4a2 2 0 0 1 4 0v1.3" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "home" ? (
        <>
          <path d="M2.6 7.4L8 3l5.4 4.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.5 6.9v6h7v-6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "health" ? (
        <>
          <rect x="3.2" y="3.2" width="9.6" height="9.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 5.2v5.6M5.2 8h5.6" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "fun" ? (
        <>
          <path d="M3 4.2h10v7.6H3z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6.4 6.2l3.8 1.8-3.8 1.8z" fill="currentColor" />
        </>
      ) : null}
      {safeIconKey === "service" ? (
        <>
          <path d="M4 3.4h8v9.2H4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <line x1="5.5" y1="6.2" x2="10.5" y2="6.2" stroke="currentColor" strokeWidth="1.1" />
          <line x1="5.5" y1="8.4" x2="10.5" y2="8.4" stroke="currentColor" strokeWidth="1.1" />
        </>
      ) : null}
      {safeIconKey === "education" ? (
        <>
          <path d="M2.6 5.3l5.4-2.1 5.4 2.1-5.4 2.1z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.8 6.7v2.8c0 .9 1.5 1.7 3.2 1.7s3.2-.8 3.2-1.7V6.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </>
      ) : null}
      {safeIconKey === "travel" ? (
        <>
          <path d="M2.5 9.3l11-2.6M6.4 8.4l1.8-4M8.1 8l3.4 2.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="4.1" cy="10.6" r="1.1" fill="currentColor" />
        </>
      ) : null}
      {safeIconKey === "utilities" ? (
        <>
          <path d="M7.2 2.8l-2.1 4h2v6.4l2.7-4.8h-2z" fill="currentColor" />
        </>
      ) : null}
      {safeIconKey === "pet" ? (
        <>
          <circle cx="8" cy="9.1" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5.1" cy="5.4" r="1.1" fill="currentColor" />
          <circle cx="7.2" cy="4.4" r="1.1" fill="currentColor" />
          <circle cx="8.8" cy="4.4" r="1.1" fill="currentColor" />
          <circle cx="10.9" cy="5.4" r="1.1" fill="currentColor" />
        </>
      ) : null}
      {safeIconKey === "custom" ? (
        <>
          <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <span className={`categoryBadge categoryIcon-${category.iconKey}`}>
      <CategoryGlyph iconKey={category.iconKey} className="categoryBadgeIcon" />
      <span className="categoryBadgeEmoji" aria-hidden>{category.emoji}</span>
    </span>
  );
}

function EditableCategoryRow({
  category,
  isEditing,
  onEdit,
  onCancel,
  onSave
}: {
  category: ExpenseCategory;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: { id: string; name: string; emoji: string; iconKey: ExpenseCategoryIconKey }) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: category.name,
    emoji: category.emoji,
    iconKey: category.iconKey
  });

  useEffect(() => {
    setDraft({
      name: category.name,
      emoji: category.emoji,
      iconKey: category.iconKey
    });
  }, [category]);

  if (isEditing) {
    return (
      <div className="categoryEditRow">
        <div className="inlineForm">
          <input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
          <select value={draft.emoji} onChange={(event) => setDraft((prev) => ({ ...prev, emoji: event.target.value }))}>
            {EXPENSE_CATEGORY_EMOJI_OPTIONS.map((emoji) => (
              <option key={emoji} value={emoji}>{emoji}</option>
            ))}
          </select>
          <select
            value={draft.iconKey}
            onChange={(event) => setDraft((prev) => ({ ...prev, iconKey: event.target.value as ExpenseCategoryIconKey }))}
          >
            {EXPENSE_CATEGORY_ICON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="rowButtons">
          <button onClick={() => void onSave({ id: category.id, name: draft.name, emoji: draft.emoji, iconKey: draft.iconKey })}>Save</button>
          <button className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rowButtons">
      <button onClick={onEdit}>Edit</button>
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: SourceType | string | null | undefined }) {
  const meta = sourceTypeMeta(sourceType);
  return (
    <span className={`sourceBadge sourceType-${meta.value.toLowerCase()}`}>
      <SourceTypeGlyph sourceType={meta.value} className="sourceBadgeIcon" />
      <span>{meta.short}</span>
    </span>
  );
}

function EditableCardRow({ card, isEditing, onEdit, onCancel, onSave, onToggle }: {
  card: Card;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Card> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(card);
  useEffect(() => setDraft(card), [card]);
  return (
    <li className="listRow">
      {isEditing ? (
        <>
          <div className="inlineForm">
            <input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
            <select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
            <select value={draft.sourceType} onChange={(event) => setDraft((prev) => ({ ...prev, sourceType: event.target.value as SourceType }))}>
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
              ))}
            </select>
          </div>
          <div className="rowButtons">
            <button onClick={() => void onSave({ id: card.id, name: draft.name, currency: draft.currency, sourceType: draft.sourceType })}>Save</button>
            <button className="secondary" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <span><SourceBadge sourceType={card.sourceType} /> {card.name} ({sourceTypeLabel(card.sourceType)} · {card.currency})</span>
          <div className="rowButtons">
            <button onClick={onEdit}>Edit</button>
            <button className="secondary" onClick={onToggle}>{card.isActive ? "Deactivate" : "Activate"}</button>
          </div>
        </>
      )}
    </li>
  );
}

function EditableIncomeRow({ income, isEditing, onEdit, onCancel, onSave, onToggle }: {
  income: Income;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Income> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(income);
  useEffect(() => setDraft(income), [income]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><label className="fieldLabel"><span>Start month</span><input type="month" value={draft.startMonth} onChange={(event) => setDraft((prev) => ({ ...prev, startMonth: event.target.value }))} /></label><label className="fieldLabel"><span>End month</span><input type="month" value={draft.endMonth ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, endMonth: event.target.value || null }))} /></label></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: income.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{income.name}: {income.amount} {income.currency} ({income.startMonth}{income.endMonth ? ` to ${income.endMonth}` : " onward"})</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{income.isActive ? "Disable" : "Enable"}</button></div></>}</li>;
}

function EditableFixedRow({ item, isEditing, onEdit, onCancel, onSave, onToggle }: {
  item: FixedExpense;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<FixedExpense> & { id: string }) => Promise<void>;
  onToggle: () => void;
}) {
  const [draft, setDraft] = useState(item);
  useEffect(() => setDraft(item), [item]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><label className="fieldLabel"><span>Start month</span><input type="month" value={draft.startMonth} onChange={(event) => setDraft((prev) => ({ ...prev, startMonth: event.target.value }))} /></label><label className="fieldLabel"><span>End month</span><input type="month" value={draft.endMonth ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, endMonth: event.target.value || null }))} /></label></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: item.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{item.name}: {item.amount} {item.currency} ({item.startMonth}{item.endMonth ? ` to ${item.endMonth}` : " onward"})</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{item.isActive ? "Disable" : "Enable"}</button></div></>}</li>;
}

function EditableExpectationRow({ row, cards, isEditing, onEdit, onCancel, onSave, onDelete }: {
  row: Expectation;
  cards: Card[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Expectation> & { id: string }) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><select value={draft.cardId} onChange={(event) => setDraft((prev) => ({ ...prev, cardId: event.target.value }))}>{cards.map((card) => <option key={card.id} value={card.id}>{sourceTypeOptionLabel(card.sourceType, card.name)}</option>)}</select><label className="fieldLabel"><span>Payment month</span><input type="month" value={draft.month} onChange={(event) => setDraft((prev) => ({ ...prev, month: event.target.value }))} /></label><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div><div className="rowButtons"><button onClick={() => void onSave({ ...draft, id: row.id })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span><SourceBadge sourceType={row.card.sourceType} /> {row.card.name} - {row.month}: {row.amount} {row.currency}</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onDelete}>Delete</button></div></>}</li>;
}

function EditableAdvancementRow({ row, isEditing, onEdit, onCancel, onSave, onToggle, onDelete }: {
  row: Advancement;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: Partial<Advancement> & { id: string }) => Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(row);
  useEffect(() => setDraft(row), [row]);
  return <li className="listRow">{isEditing ? <><div className="inlineForm"><label className="fieldLabel"><span>Advancement month</span><input type="month" value={draft.month} onChange={(event) => setDraft((prev) => ({ ...prev, month: event.target.value }))} /></label><input type="number" step="0.01" value={draft.amount} onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))} /><select value={draft.currency} onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value as Currency }))}><option value="USD">USD</option><option value="ARS">ARS</option></select><input placeholder="Note" value={draft.note ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))} /></div><div className="rowButtons"><button onClick={() => void onSave({ id: row.id, month: draft.month, amount: draft.amount, currency: draft.currency, note: draft.note })}>Save</button><button className="secondary" onClick={onCancel}>Cancel</button></div></> : <><span>{row.month}: {row.amount} {row.currency}{row.note ? ` (${row.note})` : ""}</span><div className="rowButtons"><button onClick={onEdit}>Edit</button><button className="secondary" onClick={onToggle}>{row.isActive ? "Disable" : "Enable"}</button><button className="secondary" onClick={onDelete}>Delete</button></div></>}</li>;
}
