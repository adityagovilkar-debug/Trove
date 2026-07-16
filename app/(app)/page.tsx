"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sunrise,
  Sun,
  Moon,
  Boxes,
  ShoppingBasket,
  Clock,
  Wallet,
  ShoppingCart,
  Plus,
  ScanText,
  Search,
  ArrowRight,
  TriangleAlert,
  AlertCircle,
  Minus,
  ChefHat,
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", Icon: Sunrise };
  if (h < 17) return { text: "Good afternoon", Icon: Sun };
  return { text: "Good evening", Icon: Moon };
}
function dueLabel(d: number) {
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}
function dueColor(d: number) {
  if (d < 0) return "text-rose-500";
  if (d <= 3) return "text-orange-500";
  if (d <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-text-muted";
}

// The Kitchen dashboard: the churny half of the house — food stock, expiries,
// what to buy, what you can cook. Durables and payments live in the Home space.
export default function DashboardPage() {
  const { data: allActive = [], isLoading: la } = useInventory({ status: "active" });
  const { data: allHistory = [], isLoading: lh } = useTrendsData();
  const { data: meals = [] } = useMealPlans();
  const { data: shopping = [] } = useShoppingList();
  const addShopping = useAddShoppingItems();
  const consume = useConsume();
  const [firstName, setFirstName] = useState("");

  const active = useMemo(() => allActive.filter((r) => rowSpace(r) === "kitchen"), [allActive]);
  const history = useMemo(
    () => allHistory.filter((r) => rowSpace(r) === "kitchen"),
    [allHistory],
  );

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const n =
          (data.user?.user_metadata?.full_name as string) ?? data.user?.email ?? "";
        setFirstName(n.split(" ")[0].split("@")[0]);
      });
  }, []);

  const month = new Date().toISOString().slice(0, 7);

  const stats = useMemo(() => {
    const expiring = active.filter(
      (r) => r.days_to_expiry != null && r.days_to_expiry >= 0 && r.days_to_expiry <= 7,
    ).length;
    const expired = active.filter(
      (r) => r.days_to_expiry != null && r.days_to_expiry < 0,
    ).length;
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
  // Kitchen upcoming = expiries + planned meals. Payments and warranties
  // belong to the Home space dashboard.
  const upcoming = useMemo(
    () =>
      buildUpcoming(active, [], meals)
        .filter((e) => e.kind !== "warranty")
        .slice(0, 5),
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
  const g = greeting();

  // Attention banner content (food urgency only — payments live in Home).
  const attentionBits: string[] = [];
  if (stats.expired > 0) attentionBits.push(`${stats.expired} expired`);
  if (stats.expiring > 0) attentionBits.push(`${stats.expiring} expiring this week`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <g.Icon className="h-6 w-6 text-brand-500" />
            {g.text}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {groceryCount} groceries in stock
            {stats.usedPct != null && ` · ${stats.usedPct}% used before waste`}
            {stats.toBuy > 0 && ` · ${stats.toBuy} on the shopping list`}
          </p>
        </div>
        <Link href="/add" className="btn-primary shrink-0">
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add stock</span>
        </Link>
      </div>

      {/* Attention banner */}
      {attentionBits.length > 0 && (
        <Link
          href="/upcoming"
          className="flex items-center gap-3 rounded-2xl bg-amber-400/15 px-4 py-3 ring-1 ring-inset ring-amber-500/30 transition-colors hover:bg-amber-400/25"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 text-sm font-medium text-amber-700 dark:text-amber-300">
            {attentionBits.join(" · ")}.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        </Link>
      )}

      {/* Metric cards — the food loop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ShoppingBasket} label="Groceries in stock" value={groceryCount} />
        <Stat icon={Clock} label="Expiring ≤ 7d" value={stats.expiring} tone={stats.expiring ? "amber" : undefined} />
        <Stat icon={Wallet} label="Spent this month" value={formatMoney(stats.spentThisMonth, currency)} />
        <Stat icon={ShoppingCart} label="To buy" value={stats.toBuy} />
      </div>

      {/* Two-column: upcoming + running low */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming</h2>
            <Link href="/upcoming" className="text-xs text-text-muted hover:text-text">
              View all →
            </Link>
          </div>
          {isLoading ? (
            <Skeleton />
          ) : upcoming.length === 0 ? (
            <Empty text="Nothing coming up." />
          ) : (
            <div className="divide-y">
              {upcoming.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      ev.kind === "meal"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                    )}
                  >
                    {ev.kind === "meal" ? (
                      <ChefHat className="h-4 w-4" />
                    ) : (
                      <Clock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.title}</p>
                    <p className="truncate text-xs text-text-muted">{ev.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-xs font-medium", dueColor(ev.days))}>{dueLabel(ev.days)}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (ev.kind === "expiry" && ev.inventory)
                        consume.mutate(
                          { id: ev.inventory.id, quantity: Number(ev.inventory.quantity) },
                          { onSuccess: () => toast.success(`Used 1 ${ev.title}`) },
                        );
                    }}
                    className={cn(
                      "btn-ghost shrink-0 px-2 py-1.5",
                      ev.kind !== "expiry" && "invisible",
                    )}
                    title="Use one"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Running low */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Running low</h2>
            {restock.length > 0 && (
              <button
                onClick={() => addToList(restock)}
                className="text-xs text-brand-600 hover:underline"
                disabled={addShopping.isPending}
              >
                Add all to list
              </button>
            )}
          </div>
          {isLoading ? (
            <Skeleton />
          ) : restock.length === 0 ? (
            <Empty text="You're well stocked — nothing predicted to run out." />
          ) : (
            <div className="divide-y">
              {restock.map((r) => (
                <div key={r.key} className="flex items-center gap-3 py-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      r.reason === "out"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        : r.reason === "due"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-surface-2 text-text-muted",
                    )}
                  >
                    {r.reason === "out" ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-text-muted">{r.detail}</p>
                  </div>
                  <button
                    onClick={() => addToList([r])}
                    className="btn-outline shrink-0 px-2.5 py-1.5 text-xs"
                    title="Add to shopping list"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    List
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/add" icon={ScanText} label="Add / scan" />
        <QuickAction href="/shopping" icon={ShoppingCart} label="Shopping list" />
        <QuickAction href="/recipes" icon={ChefHat} label="Recipes" />
        <button
          onClick={() => window.dispatchEvent(new Event("trove:command"))}
          className="card flex items-center justify-center gap-2 p-3 text-sm font-medium hover:bg-surface-2"
        >
          <Search className="h-[18px] w-[18px] text-brand-500" />
          Search · ⌘K
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number | string;
  tone?: "amber";
}) {
  return (
    <div className="card p-4">
      <div
        className={cn(
          "mb-3 inline-flex rounded-lg p-2",
          tone === "amber"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Boxes; label: string }) {
  return (
    <Link href={href} className="card flex items-center justify-center gap-2 p-3 text-sm font-medium hover:bg-surface-2">
      <Icon className="h-[18px] w-[18px] text-brand-500" />
      {label}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-muted">{text}</p>;
}
function Skeleton() {
  return (
    <div className="space-y-2 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}
