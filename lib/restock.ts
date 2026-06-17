import type { InventoryDetail } from "./types";

// Predict what you're about to run out of, using your purchase history.
// "out"  — you have none left of something you've bought before
// "due"  — you still have some, but you're past your usual rebuy interval
// "low"  — only a little left and no strong cadence signal
export type RestockReason = "out" | "due" | "low";

export interface RestockSuggestion {
  key: string;
  itemId: string | null;
  name: string;
  reason: RestockReason;
  detail: string;
  currentQty: number;
  unit: string | null;
  avgIntervalDays: number | null;
  daysSinceLast: number | null;
}

// Restock only makes sense for consumables. Skip durable domains.
const CONSUMABLE = new Set([null, "grocery", "household", "other"]);
const PRIORITY: Record<RestockReason, number> = { out: 0, due: 1, low: 2 };

export function computeRestock(history: InventoryDetail[]): RestockSuggestion[] {
  const groups = new Map<
    string,
    {
      name: string;
      itemId: string;
      unit: string | null;
      domainKey: string | null;
      dates: string[];
      activeQty: number;
    }
  >();

  for (const r of history) {
    const key = `${r.item_name.trim().toLowerCase()}|${r.domain_id ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        name: r.item_name,
        itemId: r.item_id,
        unit: r.unit,
        domainKey: r.domain_key,
        dates: [],
        activeQty: 0,
      };
      groups.set(key, g);
    }
    g.dates.push(r.purchase_date);
    if (r.status === "active") g.activeQty += Number(r.quantity) || 0;
  }

  const today = Date.now();
  const out: RestockSuggestion[] = [];

  for (const [key, g] of groups) {
    if (!CONSUMABLE.has(g.domainKey)) continue;

    const dates = g.dates.sort();
    let avg: number | null = null;
    if (dates.length > 1) {
      let total = 0;
      for (let i = 1; i < dates.length; i++)
        total += (+new Date(dates[i]) - +new Date(dates[i - 1])) / 86_400_000;
      avg = Math.round(total / (dates.length - 1));
    }
    const last = dates[dates.length - 1];
    const daysSinceLast = Math.round((today - +new Date(last)) / 86_400_000);

    let reason: RestockReason | null = null;
    if (g.activeQty <= 0) reason = "out";
    else if (avg != null && avg > 0 && daysSinceLast >= avg) reason = "due";
    else if (g.activeQty <= 1 && dates.length >= 2) reason = "low";
    if (!reason) continue;

    const cadence = avg != null ? `rebuy ~every ${avg}d` : `${dates.length} buys`;
    const detail =
      reason === "out"
        ? `Out · ${cadence}`
        : reason === "due"
          ? `${g.activeQty}${g.unit ? " " + g.unit : ""} left · due (${cadence})`
          : `${g.activeQty}${g.unit ? " " + g.unit : ""} left`;

    out.push({
      key,
      itemId: g.itemId,
      name: g.name,
      reason,
      detail,
      currentQty: g.activeQty,
      unit: g.unit,
      avgIntervalDays: avg,
      daysSinceLast,
    });
  }

  return out.sort(
    (a, b) =>
      PRIORITY[a.reason] - PRIORITY[b.reason] || a.name.localeCompare(b.name),
  );
}
