"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Repeat, TrendingUp, Recycle, Tag } from "lucide-react";
import { useTrendsData } from "@/lib/queries";
import { formatMoney } from "@/lib/utils";

export default function TrendsPage() {
  const { data: rows = [], isLoading } = useTrendsData();
  const currency = rows[0]?.currency ?? "INR";

  // --- Rebuy frequency: how often each item is purchased ----------------
  const rebuy = useMemo(() => {
    const map = new Map<string, { name: string; dates: string[] }>();
    for (const r of rows) {
      const k = r.item_name.toLowerCase();
      if (!map.has(k)) map.set(k, { name: r.item_name, dates: [] });
      map.get(k)!.dates.push(r.purchase_date);
    }
    return [...map.values()]
      .map((v) => {
        const sorted = v.dates.sort();
        let avgGap: number | null = null;
        if (sorted.length > 1) {
          let total = 0;
          for (let i = 1; i < sorted.length; i++)
            total += (+new Date(sorted[i]) - +new Date(sorted[i - 1])) / 86400000;
          avgGap = Math.round(total / (sorted.length - 1));
        }
        return { name: v.name, count: sorted.length, avgGap };
      })
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  // --- Monthly spend ----------------------------------------------------
  const spend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.price == null) continue;
      const key = r.purchase_date.slice(0, 7); // YYYY-MM
      map.set(key, (map.get(key) ?? 0) + Number(r.price));
    }
    return [...map.entries()]
      .sort()
      .slice(-12)
      .map(([month, total]) => ({
        month: new Date(month + "-01").toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
        }),
        total: Math.round(total),
      }));
  }, [rows]);

  // --- Waste: used vs wasted -------------------------------------------
  const waste = useMemo(() => {
    let used = 0,
      expired = 0,
      discarded = 0;
    for (const r of rows) {
      if (r.status === "finished") used++;
      else if (r.status === "expired") expired++;
      else if (r.status === "discarded") discarded++;
    }
    return { used, expired, discarded, wasted: expired + discarded };
  }, [rows]);

  // --- Per-item cost-per-unit over time --------------------------------
  // Items that have at least one priced purchase, most-bought first.
  const pricedItems = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.price == null) continue;
      map.set(r.item_name, (map.get(r.item_name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [rows]);

  const [selectedItem, setSelectedItem] = useState("");
  const activeItem = selectedItem || pricedItems[0] || "";

  const costSeries = useMemo(() => {
    return rows
      .filter(
        (r) =>
          r.item_name === activeItem && r.price != null && Number(r.quantity) > 0,
      )
      .map((r) => ({
        ts: +new Date(r.purchase_date),
        date: new Date(r.purchase_date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        unit: Math.round((Number(r.price) / Number(r.quantity)) * 100) / 100,
      }))
      .sort((a, b) => a.ts - b.ts);
  }, [rows, activeItem]);

  const costDelta =
    costSeries.length > 1
      ? costSeries[costSeries.length - 1].unit - costSeries[0].unit
      : null;

  const totalSpend = spend.reduce((s, d) => s + d.total, 0);

  if (isLoading)
    return <div className="p-8 text-sm text-text-muted">Crunching your history…</div>;

  if (rows.length === 0)
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Trends</h1>
        <div className="card p-10 text-center text-sm text-text-muted">
          Trends appear once you’ve added stock and marked some items finished.
          Come back after a few weeks of use.
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-text-muted">
          Patterns over time — what you rebuy, what you spend, what you waste.
        </p>
      </div>

      {/* Spend over time */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-5 w-5 text-brand-500" />
            Spend over time
          </h2>
          <span className="text-sm text-text-muted">
            {formatMoney(totalSpend, currency)} total
          </span>
        </div>
        {spend.length === 0 ? (
          <Hint text="Add prices when logging stock to see spend trends." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={spend} margin={{ left: -10, right: 8, top: 8 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={tooltipStyle}
                formatter={(v) => [formatMoney(Number(v), currency), "Spent"]}
              />
              <Bar dataKey="total" fill="var(--color-brand-500)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Cost per unit over time, per item */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Tag className="h-5 w-5 text-brand-500" />
            Price per unit over time
          </h2>
          {pricedItems.length > 0 && (
            <select
              className="input max-w-[220px]"
              value={activeItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              {pricedItems.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {pricedItems.length === 0 ? (
          <Hint text="Add prices when logging stock to track how an item's cost changes." />
        ) : costSeries.length < 2 ? (
          <Hint
            text={`Only one priced purchase of “${activeItem}” so far — buy it again to see the trend.`}
          />
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-3 text-sm">
              <span className="text-text-muted">
                Latest:{" "}
                <span className="font-semibold text-text">
                  {formatMoney(costSeries[costSeries.length - 1].unit, currency)}
                </span>{" "}
                / unit
              </span>
              {costDelta != null && costDelta !== 0 && (
                <span
                  className={
                    costDelta > 0 ? "text-rose-500" : "text-brand-600"
                  }
                >
                  {costDelta > 0 ? "▲" : "▼"} {formatMoney(Math.abs(costDelta), currency)} since first buy
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={costSeries} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [formatMoney(Number(v), currency), "Per unit"]}
                />
                <Line
                  type="monotone"
                  dataKey="unit"
                  stroke="var(--color-brand-500)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--color-brand-500)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rebuy frequency */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Repeat className="h-5 w-5 text-brand-500" />
            How often you rebuy
          </h2>
          <ul className="space-y-2">
            {rebuy.slice(0, 8).map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{r.name}</span>
                <span className="shrink-0 text-text-muted">
                  {r.count}×
                  {r.avgGap != null && (
                    <span className="ml-2 text-xs">~every {r.avgGap}d</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Waste */}
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Recycle className="h-5 w-5 text-brand-500" />
            Used vs wasted
          </h2>
          {waste.used + waste.wasted === 0 ? (
            <Hint text="Mark items finished or expired to track waste." />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Used up", value: waste.used },
                      { name: "Wasted", value: waste.wasted },
                    ]}
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={64}
                    paddingAngle={2}
                  >
                    <Cell fill="var(--color-brand-500)" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                <Legend color="var(--color-brand-500)" label="Used up" value={waste.used} />
                <Legend color="#f43f5e" label="Expired/tossed" value={waste.wasted} />
                <p className="pt-1 text-xs text-text-muted">
                  {waste.used + waste.wasted > 0 &&
                    `${Math.round((waste.used / (waste.used + waste.wasted)) * 100)}% used before waste`}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text)",
};

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="font-medium">{value}</span>
      <span className="text-text-muted">{label}</span>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-muted">{text}</p>;
}
