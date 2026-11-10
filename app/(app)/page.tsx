"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ScanText,
  Search,
  ArrowRight,
  Minus,
  ChefHat,
  ShoppingCart,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useTrendsData,
  useShoppingList,
  useAddShoppingItems,
  useConsume,
  useMealPlans,
} from "@/lib/queries";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { buildUpcoming } from "@/lib/upcoming";
import { computeRestock, type RestockSuggestion } from "@/lib/restock";
import { groupIntoProducts } from "@/lib/products";
import { rowSpace } from "@/lib/space";
import { cn, formatMoney } from "@/lib/utils";
import { DotRing, Section, Led } from "@/components/instrument";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function dueLabel(d: number) {
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}
function dueTone(d: number): "bad" | "watch" | "ink" {
  if (d < 0) return "bad";
  if (d <= 3) return "watch";
  return "ink";
}

// The Kitchen dashboard — the churny half of the house: food stock, expiries,
// what to buy, what you can cook. Durables and payments live in Home.
export default function DashboardPage() {
  const { data: allActive = [], isLoading: la } = useInventory({ status: "active" });
  const { data: allHistory = [], isLoading: lh } = useTrendsData();
  const { data: meals = [] } = useMealPlans();
  const { data: shopping = [] } = useShoppingList();
  const addShopping = useAddShoppingItems();
  const consume = useConsume();
  const [firstName, setFirstName] = useState("");

  const active = useMemo(() => allActive.filter((r) => rowSpace(r) === "kitchen"), [allActive]);
  const history = useMemo(() => allHistory.filter((r) => rowSpace(r) === "kitchen"), [allHistory]);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const n = (data.user?.user_metadata?.full_name as string) ?? data.user?.email ?? "";
        setFirstName(n.split(" ")[0].split("@")[0]);
      });
  }, []);

  const month = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "short" }).toUpperCase();

  const stats = useMemo(() => {
    const expiring = active.filter(
      (r) => r.days_to_expiry != null && r.days_to_expiry >= 0 && r.days_to_expiry <= 7,
    ).length;
    const expired = active.filter((r) => r.days_to_expiry != null && r.days_to_expiry < 0).length;
    const spentThisMonth = history
      .filter((r) => r.purchase_date.startsWith(month))
      .reduce((s, r) => s + Number(r.price ?? 0), 0);
    const toBuy = shopping.filter((s) => !s.is_bought).length;
    let used = 0,
      wasted = 0;
    for (const r of history) {
      if (r.status === "finished") used++;
      else if (r.status === "expired" || r.status === "discarded") wasted++;
    }
    const usedPct = used + wasted > 0 ? Math.round((used / (used + wasted)) * 100) : null;
    return { expiring, expired, spentThisMonth, toBuy, usedPct };
  }, [active, history, shopping, month]);

  const currency = active[0]?.currency ?? "INR";
  const upcoming = useMemo(
    () => buildUpcoming(active, [], meals).filter((e) => e.kind !== "warranty").slice(0, 5),
    [active, meals],
  );
  const groceryCount = useMemo(() => groupIntoProducts(active).length, [active]);

  const pendingNames = useMemo(
    () => new Set(shopping.filter((s) => !s.is_bought).map((s) => s.name.toLowerCase())),
    [shopping],
  );
  const restock = useMemo(
    () => computeRestock(history).filter((r) => !pendingNames.has(r.name.toLowerCase())).slice(0, 5),
    [history, pendingNames],
  );

  function addToList(items: RestockSuggestion[]) {
    if (!items.length) return;
    addShopping.mutate(
      items.map((r) => ({ name: r.name, itemId: r.itemId, source: "restock" as const })),
      {
        onSuccess: () =>
          toast.success(
            items.length === 1
              ? `Added ${items[0].name} to shopping list`
              : `Added ${items.length} items to shopping list`,
          ),
      },
    );
  }

  const isLoading = la || lh;
  const attention: string[] = [];
  if (stats.expired > 0) attention.push(`${stats.expired} expired`);
  if (stats.expiring > 0) attention.push(`${stats.expiring} expiring this week`);

  return (
    <div className="pn6 mx-auto max-w-5xl space-y-5">
      {/* Hero */}
      <section className="card rise p-0">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="no">KITCHEN</div>
            <h1 className="title mt-1.5 truncate">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-1.5 text-sm text-ink-3">The pantry at a glance.</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <DotRing frac={(stats.usedPct ?? 0) / 100} size={74} n={40} color="var(--pen)" label="Used before waste">
              <span className="mono text-base font-semibold">
                {stats.usedPct ?? "—"}
                {stats.usedPct != null && <span className="u">%</span>}
              </span>
            </DotRing>
            <span className="text-[8.5px] uppercase tracking-[0.14em] text-ink-3">Used · no waste</span>
          </div>
        </div>
        <div className="readouts grid-cols-2 rounded-none border-x-0 border-b-0 sm:grid-cols-4">
          <Readout k="Groceries" v={String(groceryCount)} to="/inventory" />
          <Readout
            k="Expiring ≤7d"
            v={String(stats.expiring)}
            tone={stats.expiring ? "var(--watch)" : undefined}
            to="/upcoming"
          />
          <Readout k={`Spent · ${monthLabel}`} v={formatMoney(stats.spentThisMonth, currency)} to="/trends" />
          <Readout k="To buy" v={String(stats.toBuy)} to="/shopping" />
        </div>
      </section>

      {/* Attention */}
      {attention.length > 0 && (
        <Link
          href="/upcoming"
          className="card rise i1 flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2"
        >
          <Led tone="watch" pulse />
          <span className="flex-1 text-sm font-medium" style={{ color: "var(--watch)" }}>
            {attention.join(" · ")}.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
        </Link>
      )}

      {/* Two columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card rise i2 p-4">
          <Section label="Upcoming" right={<ViewAll href="/upcoming" />} />
          <div className="mt-3">
            {isLoading ? (
              <Skeleton />
            ) : upcoming.length === 0 ? (
              <Empty text="Nothing coming up." />
            ) : (
              <ul>
                {upcoming.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0">
                    <Led tone={ev.kind === "meal" ? "good" : dueTone(ev.days)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ev.title}</p>
                      <p className="truncate text-xs text-ink-3">{ev.subtitle}</p>
                    </div>
                    <span className={cn("mono shrink-0 text-xs", toneClass(dueTone(ev.days)))}>
                      {dueLabel(ev.days)}
                    </span>
                    {ev.kind === "expiry" && ev.inventory && (
                      <button
                        onClick={() =>
                          consume.mutate(
                            { id: ev.inventory!.id, quantity: Number(ev.inventory!.quantity) },
                            { onSuccess: () => toast.success(`Used 1 ${ev.title}`) },
                          )
                        }
                        className="btn-ghost shrink-0 px-2 py-1.5"
                        title="Use one"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card rise i3 p-4">
          <Section
            label="Running low"
            right={
              restock.length > 0 ? (
                <button
                  onClick={() => addToList(restock)}
                  disabled={addShopping.isPending}
                  className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
                >
                  Add all
                </button>
              ) : undefined
            }
          />
          <div className="mt-3">
            {isLoading ? (
              <Skeleton />
            ) : restock.length === 0 ? (
              <Empty text="Well stocked — nothing predicted to run out." />
            ) : (
              <ul>
                {restock.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0">
                    <Led tone={r.reason === "out" ? "bad" : r.reason === "due" ? "watch" : "ink"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-ink-3">{r.detail}</p>
                    </div>
                    <button
                      onClick={() => addToList([r])}
                      className="btn-outline shrink-0 px-2.5 py-1.5"
                      title="Add to shopping list"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      List
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/add" icon={ScanText} label="Add / scan" />
        <QuickAction href="/shopping" icon={ShoppingCart} label="Shopping" />
        <QuickAction href="/recipes" icon={ChefHat} label="Recipes" />
        <button
          onClick={() => window.dispatchEvent(new Event("trove:command"))}
          className="card flex items-center justify-center gap-2 p-3 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-surface-2"
        >
          <Search className="h-[18px] w-[18px]" />
          Search · ⌘K
        </button>
      </div>
    </div>
  );
}

function Readout({
  k,
  v,
  tone,
  to,
}: {
  k: string;
  v: string;
  tone?: string;
  to?: string;
}) {
  const body = (
    <>
      <span className="k">{k}</span>
      <span className="v" style={tone ? { color: tone } : undefined}>
        {v}
      </span>
    </>
  );
  return to ? (
    <Link href={to} className="ro transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="ro">{body}</div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3 hover:text-ink">
      View all
    </Link>
  );
}

function toneClass(t: "bad" | "watch" | "ink") {
  return t === "bad" ? "text-bad" : t === "watch" ? "text-watch" : "text-ink-3";
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof ScanText; label: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center justify-center gap-2 p-3 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-surface-2"
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink-3">{text}</p>;
}
function Skeleton() {
  return (
    <div className="space-y-2 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
      ))}
    </div>
  );
}
