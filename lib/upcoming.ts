import type { InventoryDetail, Subscription, MealPlanWithRecipe } from "./types";
import { daysUntil } from "./subscriptions";

export type UpcomingKind = "expiry" | "subscription" | "warranty" | "meal";

export interface UpcomingEvent {
  id: string;
  kind: UpcomingKind;
  date: string; // YYYY-MM-DD
  days: number; // days until (negative = overdue/expired)
  title: string;
  subtitle: string;
  amount: number | null;
  currency: string | null;
  inventory?: InventoryDetail;
  subscription?: Subscription;
}

// Merge food expiries, subscription payments and warranty deadlines into one
// chronological stream.
export function buildUpcoming(
  inventory: InventoryDetail[],
  subscriptions: Subscription[],
  meals: MealPlanWithRecipe[] = [],
): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];

  for (const m of meals) {
    const d = daysUntil(m.plan_date);
    if (d == null) continue;
    events.push({
      id: `meal-${m.id}`,
      kind: "meal",
      date: m.plan_date,
      days: d,
      title: m.recipe_name,
      subtitle: "Planned meal",
      amount: null,
      currency: null,
    });
  }

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
        amount: null,
        currency: null,
        inventory: r,
      });
    }

    // Electronics (and anything else) warranty deadlines from attributes.
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
          amount: null,
          currency: null,
          inventory: r,
        });
      }
    }
  }

  for (const s of subscriptions) {
    if (s.status !== "active" || !s.next_payment) continue;
    const d = daysUntil(s.next_payment);
    if (d == null) continue;
    events.push({
      id: `sub-${s.id}`,
      kind: "subscription",
      date: s.next_payment,
      days: d,
      title: s.name,
      subtitle: s.category ? `${s.category} payment` : "Payment due",
      amount: s.price,
      currency: s.currency,
      subscription: s,
    });
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
