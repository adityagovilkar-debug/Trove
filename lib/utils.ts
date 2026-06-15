import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatMoney(value: number | null | undefined, currency = "INR") {
  if (value == null) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export type ExpiryBucket = "expired" | "critical" | "soon" | "ok" | "none";

// Classify how urgent an item's expiry is. critical <= 3 days, soon <= 7.
export function expiryBucket(days: number | null | undefined): ExpiryBucket {
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= 3) return "critical";
  if (days <= 7) return "soon";
  return "ok";
}

export function expiryLabel(days: number | null | undefined): string {
  if (days == null) return "No expiry";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `${days} days left`;
}

export const EXPIRY_STYLES: Record<ExpiryBucket, string> = {
  expired: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30",
  critical: "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30",
  soon: "bg-amber-400/15 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  none: "bg-slate-400/10 text-slate-500 dark:text-slate-400 ring-slate-400/20",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
