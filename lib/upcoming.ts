import type { InventoryDetail } from "./types";

export type UpcomingKind = "expiry" | "warranty";

export interface UpcomingEvent {
  id: string;
  kind: UpcomingKind;
  date: string; // YYYY-MM-DD
  days: number; // days until (negative = overdue/expired)
  title: string;
  subtitle: string;
  inventory: InventoryDetail;
}

// Whole days from today (local) until a YYYY-MM-DD date; negative = past.
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000);
}

// Food expiries and warranty deadlines, as one chronological stream.
export function buildUpcoming(inventory: InventoryDetail[]): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];

  for (const r of inventory) {
    if (r.status !== "active") continue;

    if (r.expiry_date && r.days_to_expiry != null) {
      events.push({
        id: `exp-${r.id}`,
        kind: "expiry",
        date: r.expiry_date,
        days: r.days_to_expiry,
        title: r.item_name,
        subtitle: `${r.quantity}${r.unit ? " " + r.unit : ""}${
          r.location_name ? " · " + r.location_name : ""
        }`,
        inventory: r,
      });
    }

    const warranty = r.item_attributes?.["warranty_until"];
    if (typeof warranty === "string" && warranty) {
      const d = daysUntil(warranty);
      if (d != null) {
        events.push({
          id: `war-${r.id}`,
          kind: "warranty",
          date: warranty,
          days: d,
          title: r.item_name,
          subtitle: "Warranty ends",
          inventory: r,
        });
      }
    }
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface UpcomingBucket {
  label: string;
  events: UpcomingEvent[];
}

// Group sorted events into human time buckets.
export function bucketUpcoming(events: UpcomingEvent[]): UpcomingBucket[] {
  const buckets: Record<string, UpcomingEvent[]> = {
    Overdue: [],
    Today: [],
    "This week": [],
    "This month": [],
    Later: [],
  };
  for (const e of events) {
    if (e.days < 0) buckets["Overdue"].push(e);
    else if (e.days === 0) buckets["Today"].push(e);
    else if (e.days <= 7) buckets["This week"].push(e);
    else if (e.days <= 31) buckets["This month"].push(e);
    else buckets["Later"].push(e);
  }
  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, events: list }));
}
