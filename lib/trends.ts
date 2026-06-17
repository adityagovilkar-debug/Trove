import type { InventoryDetail } from "./types";

export type RangeKey = "3m" | "6m" | "1y" | "all";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

// Earliest purchase_date (YYYY-MM-DD) included by a range, or null for "all".
export function rangeStart(key: RangeKey): string | null {
  if (key === "all") return null;
  const d = new Date();
  if (key === "3m") d.setMonth(d.getMonth() - 3);
  else if (key === "6m") d.setMonth(d.getMonth() - 6);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function inRange(lots: InventoryDetail[], key: RangeKey): InventoryDetail[] {
  const start = rangeStart(key);
  return start ? lots.filter((l) => l.purchase_date >= start) : lots;
}

// Spend grouped by month (YYYY-MM) → label + total, chronological.
export function monthlySpend(lots: InventoryDetail[]) {
  const m = new Map<string, number>();
  for (const l of lots) {
    if (l.price == null) continue;
    const k = l.purchase_date.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + Number(l.price));
  }
  return [...m.entries()]
    .sort()
    .map(([month, total]) => ({
      month: new Date(month + "-01").toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
      total: Math.round(total),
    }));
}

// Spend grouped by an arbitrary label (category, store…), largest first.
export function spendBy(
  lots: InventoryDetail[],
  pick: (l: InventoryDetail) => string | null,
) {
  const m = new Map<string, number>();
  for (const l of lots) {
    if (l.price == null) continue;
    const label = pick(l);
    if (!label) continue;
    m.set(label, (m.get(label) ?? 0) + Number(l.price));
  }
  return [...m.entries()]
    .map(([label, total]) => ({ label, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total);
}

// Sum of price for lots whose purchase_date falls in [start, end).
export function spendBetween(lots: InventoryDetail[], start: string, end: string) {
  return lots.reduce(
    (s, l) =>
      l.price != null && l.purchase_date >= start && l.purchase_date < end
        ? s + Number(l.price)
        : s,
    0,
  );
}

export interface PriceTrend {
  key: string;
  name: string;
  unit: string | null;
  currency: string;
  series: { date: string; ts: number; unit: number }[];
  first: number;
  last: number;
  changePct: number;
  totalSpend: number;
  buys: number;
}

// Per-product unit-price history. Only products with ≥2 priced purchases (you
// need at least two points for a trend). This powers the price-tracker table.
export function priceTrends(lots: InventoryDetail[]): PriceTrend[] {
  const groups = new Map<string, InventoryDetail[]>();
  for (const l of lots) {
    if (l.price == null || Number(l.quantity) <= 0) continue;
    const key = `${l.item_name.trim().toLowerCase()}|${l.domain_id ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  const out: PriceTrend[] = [];
  for (const [key, ls] of groups) {
    if (ls.length < 2) continue;
    const series = ls
      .map((l) => ({
        date: l.purchase_date,
        ts: +new Date(l.purchase_date),
        unit: Math.round((Number(l.price) / Number(l.quantity)) * 100) / 100,
      }))
      .sort((a, b) => a.ts - b.ts);
    const first = series[0].unit;
    const last = series[series.length - 1].unit;
    out.push({
      key,
      name: ls[0].item_name,
      unit: ls[0].unit,
      currency: ls[0].currency,
      series,
      first,
      last,
      changePct: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
      totalSpend: Math.round(ls.reduce((s, l) => s + Number(l.price), 0)),
      buys: series.length,
    });
  }
  return out;
}

// One "personal CPI" number: how much more (or less) your basket costs now vs
// at the start, weighted by how much you spend on each item.
export function basketInflation(trends: PriceTrend[]): number | null {
  const weight = trends.reduce((s, t) => s + t.totalSpend, 0);
  if (weight === 0) return null;
  const w = trends.reduce((s, t) => s + t.totalSpend * t.changePct, 0);
  return Math.round((w / weight) * 10) / 10;
}

// Rebuy frequency: how many times and how often each product is purchased.
export function rebuyFrequency(lots: InventoryDetail[]) {
  const m = new Map<string, { name: string; dates: string[] }>();
  for (const l of lots) {
    const k = l.item_name.toLowerCase();
    if (!m.has(k)) m.set(k, { name: l.item_name, dates: [] });
    m.get(k)!.dates.push(l.purchase_date);
  }
  return [...m.values()]
    .map((v) => {
      const d = v.dates.sort();
      let avg: number | null = null;
      if (d.length > 1) {
        let t = 0;
        for (let i = 1; i < d.length; i++)
          t += (+new Date(d[i]) - +new Date(d[i - 1])) / 86_400_000;
        avg = Math.round(t / (d.length - 1));
      }
      return { name: v.name, count: d.length, avgGap: avg };
    })
    .sort((a, b) => b.count - a.count);
}
