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

// Instrument tones: only urgency carries colour. Healthy stock reads as
// plain ink — green is reserved for "good" outcomes, not "nothing wrong".
export const EXPIRY_STYLES: Record<ExpiryBucket, string> = {
  expired: "bg-bad/12 text-bad ring-bad/35",
  critical: "bg-bad/8 text-bad ring-bad/25",
  soon: "bg-watch/12 text-watch ring-watch/30",
  ok: "bg-surface-2 text-ink-2 ring-border",
  none: "bg-surface-2 text-ink-3 ring-border",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  // Date-only strings parse as UTC midnight, which renders as the *previous*
  // day in negative-UTC timezones. Pin them to local midnight instead.
  const local = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00") : new Date(d);
  return local.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
