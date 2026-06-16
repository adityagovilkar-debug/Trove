import type { BillingCycle, Subscription } from "./types";

export const BILLING_CYCLES: { value: BillingCycle; label: string; days: number }[] = [
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "quarterly", label: "Quarterly", days: 91 },
  { value: "yearly", label: "Yearly", days: 365 },
  { value: "custom", label: "Custom (days)", days: 30 },
];

export const SUBSCRIPTION_CATEGORIES = [
  "Streaming",
  "Music",
  "Software / SaaS",
  "Cloud / Storage",
  "News / Media",
  "Gaming",
  "Fitness / Health",
  "Utilities",
  "Insurance",
  "Telecom / Internet",
  "Education",
  "Membership",
  "Other",
];

export function cycleDays(s: Pick<Subscription, "billing_cycle" | "cycle_days">): number {
  if (s.billing_cycle === "custom") return s.cycle_days || 30;
  return BILLING_CYCLES.find((c) => c.value === s.billing_cycle)?.days ?? 30;
}

// Normalise a subscription's cost to a per-month figure for totals.
export function monthlyCost(s: Subscription): number {
  const price = Number(s.price) || 0;
  switch (s.billing_cycle) {
    case "weekly":
      return (price * 52) / 12;
    case "monthly":
      return price;
    case "quarterly":
      return price / 3;
    case "yearly":
      return price / 12;
    case "custom":
      return price * (365 / (s.cycle_days || 30)) / 12;
  }
}

export function yearlyCost(s: Subscription): number {
  return monthlyCost(s) * 12;
}

// Days until the next payment (negative = overdue), or null if unset.
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date + "T00:00:00").getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

// Advance a date by one billing cycle (used by "Mark paid").
export function advancePayment(
  s: Pick<Subscription, "billing_cycle" | "cycle_days" | "next_payment">,
): string | null {
  if (!s.next_payment) return null;
  const d = new Date(s.next_payment + "T00:00:00");
  if (s.billing_cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (s.billing_cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (s.billing_cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + cycleDays(s));
  return d.toISOString().slice(0, 10);
}
