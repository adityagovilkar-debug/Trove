"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  Wallet,
  Trash2,
  Gauge,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useTrendsData, useRefData } from "@/lib/queries";
import {
  RANGES,
  type RangeKey,
  inRange,
  monthlySpend,
  spendBy,
  spendBetween,
  priceTrends,
  basketInflation,
  rebuyFrequency,
} from "@/lib/trends";
import { cn, formatMoney } from "@/lib/utils";

type SortKey = "change" | "spend" | "name";

export default function TrendsPage() {
  const { data: all = [], isLoading } = useTrendsData();
  const { data: ref } = useRefData();

  const [range, setRange] = useState<RangeKey>("6m");
  const [domainId, setDomainId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("change");
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Domain filter applies to everything; range applies to in-window analytics.
  const domainLots = useMemo(
    () => (domainId ? all.filter((l) => l.domain_id === domainId) : all),
    [all, domainId],
  );
  const lots = useMemo(() => inRange(domainLots, range), [domainLots, range]);
  const currency = all[0]?.currency ?? "INR";

  const spend = useMemo(() => monthlySpend(lots), [lots]);
  const trends = useMemo(() => priceTrends(lots), [lots]);
  const inflation = useMemo(() => basketInflation(trends), [trends]);
  const byCategory = useMemo(() => spendBy(lots, (l) => l.category_name).slice(0, 6), [lots]);
  const byStore = useMemo(() => spendBy(lots, (l) => l.store_name).slice(0, 6), [lots]);
  const rebuy = useMemo(() => rebuyFrequency(lots), [lots]);

  const totalSpent = spend.reduce((s, d) => s + d.total, 0);
  const months = Math.max(1, spend.length);
  const wasted = useMemo(
    () =>
      lots.reduce(
        (s, l) =>
          (l.status === "expired" || l.status === "discarded") && l.price != null
            ? s + Number(l.price)
            : s,
        0,
      ),
    [lots],
  );

  // Month-over-month comparison (uses fixed calendar months, not the range).
  const mom = useMemo(() => {
    const now = new Date();
    const f = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const y = now.getFullYear();
    const m = now.getMonth();
    const thisM = spendBetween(domainLots, f(y, m), f(y, m + 1));
    const lastM = spendBetween(domainLots, f(y, m - 1), f(y, m));
    const pct = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : null;
    return { thisM: Math.round(thisM), pct };
  }, [domainLots]);

  const leaderboard = useMemo(() => {
    let arr = trends;
    const q = search.trim().toLowerCase();
    if (q) arr = arr.filter((t) => t.name.toLowerCase().includes(q));
    return [...arr].sort((a, b) => {
      if (sort === "spend") return b.totalSpend - a.totalSpend;
      if (sort === "name") return a.name.localeCompare(b.name);
      return Math.abs(b.changePct) - Math.abs(a.changePct);
    });
  }, [trends, search, sort]);

  const biggestMover = useMemo(
    () => [...trends].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0],
    [trends],
  );

  if (isLoading)
    return <div className="p-8 text-sm text-text-muted">Crunching your history…</div>;

  if (all.length === 0)
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Trends</h1>
        <div className="card p-10 text-center text-sm text-text-muted">
          Trends appear once you’ve logged a few purchases with prices.
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
          <p className="text-sm text-text-muted">What you buy, spend, and waste over time.</p>
        </div>
        <div className="flex rounded-xl bg-surface-2 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.key ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Domain filter */}
      {ref && ref.domains.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={domainId === null} onClick={() => setDomainId(null)}>
            All types
          </Chip>
          {ref.domains.map((d) => (
            <Chip key={d.id} active={domainId === d.id} onClick={() => setDomainId(d.id)}>
              {d.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label={`Spent · ${range === "all" ? "all time" : range.toUpperCase()}`} value={formatMoney(totalSpent, currency)} />
        <Stat icon={TrendingUp} label="Avg / month" value={formatMoney(Math.round(totalSpent / months), currency)} />
        <Stat icon={Trash2} label="Wasted" value={formatMoney(Math.round(wasted), currency)} tone={wasted > 0 ? "rose" : undefined} />
        <Stat
          icon={Gauge}
          label="Basket inflation"
          value={inflation == null ? "—" : `${inflation > 0 ? "+" : ""}${inflation}%`}
          tone={inflation != null && inflation > 0 ? "rose" : inflation != null && inflation < 0 ? "brand" : undefined}
        />
      </div>

      {/* Spend over time */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Spend over time</h2>
          <span className="text-sm text-text-muted">
            This month {formatMoney(mom.thisM, currency)}
            {mom.pct != null && (
              <span className={cn("ml-1 font-medium", mom.pct > 0 ? "text-rose-500" : "text-brand-600")}>
                {mom.pct > 0 ? "▲" : "▼"} {Math.abs(mom.pct)}% vs last
              </span>
            )}
          </span>
        </div>
        {spend.length === 0 ? (
          <Hint text="Add prices when logging stock to see spend." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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

      {/* Price tracker leaderboard */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Price tracker</h2>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5 text-xs">
            {([
              ["change", "Biggest change"],
              ["spend", "Most spent"],
              ["name", "A–Z"],
            ] as [SortKey, string][]).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium",
                  sort === k ? "bg-surface text-text shadow-sm" : "text-text-muted",
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${trends.length} tracked item${trends.length === 1 ? "" : "s"}…`}
            className="input pl-10"
          />
        </div>

        {trends.length === 0 ? (
          <Hint text="Buy an item twice (with prices) and its price trend shows up here." />
        ) : leaderboard.length === 0 ? (
          <Hint text="No items match that search." />
        ) : (
          <div className="divide-y">
            {leaderboard.map((t) => {
              const up = t.changePct > 0;
              const flat = t.changePct === 0;
              const open = openKey === t.key;
              return (
                <div key={t.key}>
                  <button
                    onClick={() => setOpenKey(open ? null : t.key)}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t.name}
                      {t.brand && <span className="font-normal text-text-muted"> · {t.brand}</span>}
                      {t.unit && <span className="text-text-muted"> · /{t.unit}</span>}
                    </span>
                    <span className="shrink-0 text-sm">{formatMoney(t.last, currency)}</span>
                    <span
                      className={cn(
                        "chip shrink-0 ring-inset",
                        flat
                          ? "bg-surface-2 text-text-muted ring-border"
                          : up
                            ? "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-400"
                            : "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400",
                      )}
                    >
                      {!flat && (up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
                      {up ? "+" : ""}
                      {t.changePct}%
                    </span>
                    <Sparkline
                      series={t.series}
                      color={flat ? "var(--text-muted)" : up ? "#f43f5e" : "#10b981"}
                    />
                  </button>
                  {open && (
                    <div className="pb-3 pl-7">
                      <p className="mb-1 text-xs text-text-muted">
                        {formatMoney(t.first, currency)} → {formatMoney(t.last, currency)} over {t.buys} buys ·{" "}
                        {formatMoney(t.totalSpend, currency)} total
                      </p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={t.series} margin={{ left: -12, right: 8, top: 6 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            tick={{ fontSize: 11 }}
                            stroke="var(--text-muted)"
                          />
                          <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={40} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            labelFormatter={(d) => new Date(d).toLocaleDateString()}
                            formatter={(v) => [formatMoney(Number(v), currency), "Per unit"]}
                          />
                          <Line type="monotone" dataKey="unit" stroke="var(--color-brand-500)" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {biggestMover && (
          <p className="mt-3 text-xs text-text-muted">
            Biggest mover:{" "}
            <span className="font-medium text-text">
              {biggestMover.name}
              {biggestMover.brand ? ` · ${biggestMover.brand}` : ""}
            </span>{" "}
            {biggestMover.changePct > 0 ? "+" : ""}
            {biggestMover.changePct}%
          </p>
        )}
      </section>

      {/* Spend breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="Spend by category" rows={byCategory} currency={currency} empty="Tag items with a category to see this." />
        <Breakdown title="Spend by store" rows={byStore} currency={currency} empty="Record where you buy to see this." />
      </div>

      {/* Rebuy frequency */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">How often you rebuy</h2>
        {rebuy.length === 0 ? (
          <Hint text="Nothing yet." />
        ) : (
          <ul className="space-y-2">
            {rebuy.slice(0, 8).map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">
                  {r.name}
                  {r.brand && <span className="font-normal text-text-muted"> · {r.brand}</span>}
                </span>
                <span className="shrink-0 text-text-muted">
                  {r.count}×{r.avgGap != null && <span className="ml-2 text-xs">~every {r.avgGap}d</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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

const TONES: Record<string, string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  slate: "bg-surface-2 text-text-muted",
};

function Stat({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="card p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function Sparkline({ series, color }: { series: { unit: number }[]; color: string }) {
  const vals = series.map((s) => s.unit);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = vals.length;
  const pts = vals
    .map((v, i) => {
      const x = n === 1 ? 0 : (i / (n - 1)) * 64;
      const y = 19 - ((v - min) / span) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="64" height="20" viewBox="0 0 64 20" className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function Breakdown({
  title,
  rows,
  currency,
  empty,
}: {
  title: string;
  rows: { label: string; total: number }[];
  currency: string;
  empty: string;
}) {
  const max = rows[0]?.total ?? 1;
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <Hint text={empty} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 text-text-muted">{formatMoney(r.total, currency)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                <div
                  className="h-1.5 rounded-full bg-brand-500"
                  style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "chip ring-border ring-inset transition-colors",
        active ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Hint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-muted">{text}</p>;
}
