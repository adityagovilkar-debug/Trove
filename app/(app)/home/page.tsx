"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  CreditCard,
  MapPin,
  ShieldCheck,
  Check,
  Plus,
  Search,
  Hammer,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useSubscriptions,
  useMarkSubscriptionPaid,
  useRefData,
  useLocationPaths,
  useHomeTasks,
  useToggleHomeTask,
  usePlans,
} from "@/lib/queries";
import { buildUpcoming } from "@/lib/upcoming";
import { groupIntoProducts } from "@/lib/products";
import { rowSpace, domainSpace } from "@/lib/space";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import type { PlanStatus } from "@/lib/types";

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  idea: "idea",
  planned: "planned",
  in_progress: "in progress",
  done: "done",
};

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

// The Home dashboard: the calm half of the house — durables and where they
// live, warranties, and recurring payments. Food churn stays in Kitchen.
export default function HomeDashboardPage() {
  const { data: allActive = [], isLoading } = useInventory({ status: "active" });
  const { data: subs = [] } = useSubscriptions();
  const { data: ref } = useRefData();
  const { data: tasks = [] } = useHomeTasks();
  const { data: plans = [] } = usePlans();
  const markPaid = useMarkSubscriptionPaid();
  const toggleTask = useToggleHomeTask();
  const locPaths = useLocationPaths();

  const things = useMemo(
    () => allActive.filter((r) => rowSpace(r) === "home"),
    [allActive],
  );
  const groups = useMemo(() => groupIntoProducts(things), [things]);
  const openTasks = useMemo(() => tasks.filter((t) => !t.is_done), [tasks]);
  const activePlans = useMemo(() => plans.filter((p) => p.status !== "done"), [plans]);
  const currency = ref?.household.base_currency ?? "INR";

  // Warranties + payments — the Home space's timeline.
  const upcoming = useMemo(
    () =>
      buildUpcoming(things, subs).filter(
        (e) => e.kind === "warranty" || e.kind === "subscription",
      ),
    [things, subs],
  );
  const warrantiesSoon = upcoming.filter(
    (e) => e.kind === "warranty" && e.days >= 0 && e.days <= 30,
  ).length;

  const byType = useMemo(() => {
    const counts = new Map<string, { id: string | null; name: string; count: number }>();
    for (const g of groups) {
      const key = g.domainId ?? "none";
      const cur = counts.get(key) ?? { id: g.domainId, name: g.domainName ?? "Other", count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [groups]);

  const recent = useMemo(
    () => [...things].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [things],
  );

  const homeDomainCount = (ref?.domains ?? []).filter((d) => domainSpace(d) === "home").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="mt-1 text-sm text-text-muted">
            {groups.length} things tracked across the house — search above to find any of them.
          </p>
        </div>
        <Link href="/add" className="btn-primary shrink-0">
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add a thing</span>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Boxes} label="Things tracked" value={groups.length} />
        <Stat
          icon={Hammer}
          label="Open fix-its"
          value={openTasks.length}
          tone={openTasks.length ? "amber" : undefined}
        />
        <Stat
          icon={ShieldCheck}
          label="Warranties ≤ 30d"
          value={warrantiesSoon}
          tone={warrantiesSoon ? "amber" : undefined}
        />
        <Stat icon={Lightbulb} label="Active plans" value={activePlans.length} />
      </div>

      {/* By type */}
      {byType.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">By type:</span>
          {byType.map((d) => (
            <Link
              key={d.name}
              href={d.id ? `/things?domain=${d.id}` : "/things"}
              className="chip bg-surface-2 text-text-muted ring-border ring-inset transition-colors hover:text-text"
            >
              {d.name} <span className="font-semibold text-text">{d.count}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fix-it preview */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Fix-it</h2>
            <Link href="/fixit" className="text-xs text-text-muted hover:text-text">
              All tasks →
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <Empty text="Nothing to fix — the house is behaving. 🔧" />
          ) : (
            <div className="divide-y">
              {openTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => toggleTask.mutate({ id: t.id, is_done: true })}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border hover:border-brand-500"
                    aria-label="Mark done"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    {(t.location_id || t.priority === "high") && (
                      <p className="flex items-center gap-2 truncate text-xs text-text-muted">
                        {t.priority === "high" && (
                          <span className="font-medium text-rose-500">high priority</span>
                        )}
                        {t.location_id && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {locPaths.get(t.location_id) ?? ""}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Warranties + payments */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Warranties & payments</h2>
            <Link href="/subscriptions" className="text-xs text-text-muted hover:text-text">
              Subscriptions →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty text="No warranty deadlines or payments coming up." />
          ) : (
            <div className="divide-y">
              {upcoming.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      ev.kind === "subscription"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
                    )}
                  >
                    {ev.kind === "subscription" ? (
                      <CreditCard className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.title}</p>
                    <p className="truncate text-xs text-text-muted">{ev.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {ev.amount != null && (
                      <p className="text-xs font-medium">{formatMoney(ev.amount, ev.currency ?? currency)}</p>
                    )}
                    <p className={cn("text-xs font-medium", dueColor(ev.days))}>{dueLabel(ev.days)}</p>
                  </div>
                  {ev.kind === "subscription" && ev.subscription && (
                    <button
                      onClick={() =>
                        markPaid.mutate(ev.subscription!, {
                          onSuccess: () => toast.success(`Recorded payment for ${ev.title}`),
                        })
                      }
                      className="btn-ghost shrink-0 px-2 py-1.5"
                      title="Mark paid"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently added things */}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Recently added</h2>
            <Link href="/things" className="text-xs text-text-muted hover:text-text">
              All things →
            </Link>
          </div>
          {isLoading ? (
            <Empty text="Loading…" />
          ) : recent.length === 0 ? (
            <Empty text={`Nothing here yet — add your first thing (${homeDomainCount} types to choose from).`} />
          ) : (
            <div className="divide-y">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.item_name}
                      {r.item_brand && <span className="font-normal text-text-muted"> · {r.item_brand}</span>}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-text-muted">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {(r.location_id && locPaths.get(r.location_id)) || r.location_name || "Unfiled"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">{formatDate(r.purchase_date)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Plans preview */}
      {activePlans.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Lightbulb className="h-4 w-4 text-brand-500" />
              Plans
            </h2>
            <Link href="/plans" className="text-xs text-text-muted hover:text-text">
              All plans →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {activePlans.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href="/plans"
                className="chip bg-surface-2 text-text ring-border ring-inset transition-colors hover:bg-surface"
              >
                {p.title}
                <span className="text-text-muted">· {PLAN_STATUS_LABEL[p.status]}</span>
                {p.budget != null && (
                  <span className="font-medium">· {formatMoney(p.budget, currency)}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/fixit" icon={Hammer} label="Fix-it" />
        <QuickAction href="/plans" icon={Lightbulb} label="Plans" />
        <QuickAction href="/subscriptions" icon={CreditCard} label="Subscriptions" />
        <button
          onClick={() => window.dispatchEvent(new Event("trove:command"))}
          className="card flex items-center justify-center gap-2 p-3 text-sm font-medium hover:bg-surface-2"
        >
          <Search className="h-[18px] w-[18px] text-brand-500" />
          Where is… · ⌘K
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
