"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanText, Search, ArrowRight, Minus, ShoppingCart, Plus, Hammer } from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useTrendsData,
  useShoppingList,
  useAddShoppingItems,
  useConsume,
  useHomeTasks,
} from "@/lib/queries";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { buildUpcoming } from "@/lib/upcoming";
import { computeRestock, type RestockSuggestion } from "@/lib/restock";
import { groupIntoProducts } from "@/lib/products";
import { cn } from "@/lib/utils";
import { Section, Led } from "@/components/instrument";

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

// Interim whole-house overview (rework phase 1). Phase 2 replaces this with
// the search-first Home from docs/mockups/rework.html.
export default function DashboardPage() {
  const { data: active = [], isLoading: la } = useInventory({ status: "active" });
  const { data: history = [], isLoading: lh } = useTrendsData();
  const { data: shopping = [] } = useShoppingList();
  const { data: tasks = [] } = useHomeTasks();
  const addShopping = useAddShoppingItems();
  const consume = useConsume();
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const n = (data.user?.user_metadata?.full_name as string) ?? data.user?.email ?? "";
        setFirstName(n.split(" ")[0].split("@")[0]);
      });
  }, []);

  const stats = useMemo(() => {
    const expiring = active.filter(
      (r) => r.days_to_expiry != null && r.days_to_expiry >= 0 && r.days_to_expiry <= 7,
    ).length;
    const expired = active.filter((r) => r.days_to_expiry != null && r.days_to_expiry < 0).length;
    const toBuy = shopping.filter((s) => !s.is_bought).length;
    const openFixes = tasks.filter((t) => !t.is_done).length;
    return { expiring, expired, toBuy, openFixes };
  }, [active, shopping, tasks]);

  const upcoming = useMemo(() => buildUpcoming(active).slice(0, 6), [active]);
  const productCount = useMemo(() => groupIntoProducts(active).length, [active]);

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
        <div className="p-5">
          <div className="no">TROVE</div>
          <h1 className="title mt-1.5 truncate">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">Everything in the house, and where it is.</p>
        </div>
        <div
          className="readouts grid-cols-2 rounded-none border-x-0 border-b-0 sm:grid-cols-4"
          data-loading={isLoading || undefined}
        >
          <Readout k="In stock" v={String(productCount)} to="/inventory" />
          <Readout
            k="Expiring ≤7d"
            v={String(stats.expiring)}
            tone={stats.expiring ? "var(--watch)" : undefined}
            to="/upcoming"
          />
          <Readout k="Open fix-its" v={String(stats.openFixes)} to="/fixit" />
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
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0"
                  >
                    <Led tone={dueTone(ev.days)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ev.title}</p>
                      <p className="truncate text-xs text-ink-3">{ev.subtitle}</p>
                    </div>
                    <span className={cn("mono shrink-0 text-xs", toneClass(dueTone(ev.days)))}>
                      {dueLabel(ev.days)}
                    </span>
                    {ev.kind === "expiry" && (
                      <button
                        onClick={() =>
                          consume.mutate(
                            { id: ev.inventory.id, quantity: Number(ev.inventory.quantity) },
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
              <Empty text="Nothing looks like it is running out." />
            ) : (
              <ul>
                {restock.map((r) => (
                  <li
                    key={r.key}
                    className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0"
                  >
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
        <QuickAction href="/fixit" icon={Hammer} label="Fix-it" />
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

function Readout({ k, v, tone, to }: { k: string; v: string; tone?: string; to?: string }) {
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
