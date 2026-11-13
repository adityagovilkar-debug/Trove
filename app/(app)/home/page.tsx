"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapPin, Check, Plus, Search, Hammer, Lightbulb } from "lucide-react";
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
import { DotRing, Section, Led } from "@/components/instrument";

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
function dueTone(d: number): "bad" | "watch" | "ink" {
  if (d < 0) return "bad";
  if (d <= 3) return "watch";
  return "ink";
}
function toneClass(t: "bad" | "watch" | "ink") {
  return t === "bad" ? "text-bad" : t === "watch" ? "text-watch" : "text-ink-3";
}

// The Home dashboard — the calm half of the house: durables and where they
// live, warranties, payments, fix-its, plans. Food churn stays in Kitchen.
export default function HomeDashboardPage() {
  const { data: allActive = [], isLoading } = useInventory({ status: "active" });
  const { data: subs = [] } = useSubscriptions();
  const { data: ref } = useRefData();
  const { data: tasks = [] } = useHomeTasks();
  const { data: plans = [] } = usePlans();
  const markPaid = useMarkSubscriptionPaid();
  const toggleTask = useToggleHomeTask();
  const locPaths = useLocationPaths();

  const things = useMemo(() => allActive.filter((r) => rowSpace(r) === "home"), [allActive]);
  const groups = useMemo(() => groupIntoProducts(things), [things]);
  const openTasks = useMemo(() => tasks.filter((t) => !t.is_done), [tasks]);
  const activePlans = useMemo(() => plans.filter((p) => p.status !== "done"), [plans]);
  const currency = ref?.household.base_currency ?? "INR";
  const upkeep = tasks.length ? (tasks.length - openTasks.length) / tasks.length : null;

  const upcoming = useMemo(
    () => buildUpcoming(things, subs).filter((e) => e.kind === "warranty" || e.kind === "subscription"),
    [things, subs],
  );
  const warrantiesSoon = upcoming.filter((e) => e.kind === "warranty" && e.days >= 0 && e.days <= 30).length;

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
    <div className="pn2 mx-auto max-w-5xl space-y-5">
      {/* Hero */}
      <section className="card rise p-0">
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="no">HOME</div>
            <h1 className="title mt-1.5">Around the house</h1>
            <p className="mt-1.5 text-sm text-ink-3">
              {groups.length} things tracked — search above to find any of them.
            </p>
          </div>
          {upkeep != null ? (
            <div className="flex shrink-0 flex-col items-center gap-1">
              <DotRing frac={upkeep} size={74} n={40} color="var(--pen)" label="House upkeep">
                <span className="mono text-base font-semibold">
                  {Math.round(upkeep * 100)}
                  <span className="u">%</span>
                </span>
              </DotRing>
              <span className="text-[8.5px] uppercase tracking-[0.14em] text-ink-3">Fix-its done</span>
            </div>
          ) : null}
        </div>
        <div className="readouts grid-cols-2 rounded-none border-x-0 border-b-0 sm:grid-cols-4" data-loading={isLoading || undefined}>
          <Readout k="Things" v={String(groups.length)} to="/things" />
          <Readout
            k="Open fix-its"
            v={String(openTasks.length)}
            tone={openTasks.length ? "var(--watch)" : undefined}
            to="/fixit"
          />
          <Readout
            k="Warranties ≤30d"
            v={String(warrantiesSoon)}
            tone={warrantiesSoon ? "var(--watch)" : undefined}
            to="/upcoming"
          />
          <Readout k="Active plans" v={String(activePlans.length)} to="/plans" />
        </div>
      </section>

      {/* By type */}
      {byType.length > 0 && (
        <div className="rise i1 flex flex-wrap items-center gap-2">
          <span className="cap">By type</span>
          {byType.map((d) => (
            <Link
              key={d.name}
              href={d.id ? `/things?domain=${d.id}` : "/things"}
              className="chip bg-surface text-ink-3 ring-rule ring-inset transition-colors hover:text-ink"
            >
              {d.name} <span className="mono font-semibold text-ink">{d.count}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fix-it preview */}
        <section className="card rise i2 p-4">
          <Section label="Fix-it" right={<ViewAll href="/fixit" />} />
          <div className="mt-3">
            {openTasks.length === 0 ? (
              <Empty text="Nothing to fix — the house is behaving." />
            ) : (
              <ul>
                {openTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0">
                    <button
                      onClick={() => toggleTask.mutate({ id: t.id, is_done: true })}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-ink-3 transition-colors hover:border-ink"
                      aria-label="Mark done"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {(t.location_id || t.priority === "high") && (
                        <p className="flex items-center gap-2 truncate text-xs text-ink-3">
                          {t.priority === "high" && <span className="font-medium text-bad">high</span>}
                          {t.location_id && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {locPaths.get(t.location_id) ?? ""}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Warranties + payments */}
        <section className="card rise i3 p-4">
          <Section label="Warranties & payments" right={<ViewAll href="/subscriptions" />} />
          <div className="mt-3">
            {upcoming.length === 0 ? (
              <Empty text="No warranty deadlines or payments coming up." />
            ) : (
              <ul>
                {upcoming.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0">
                    <Led tone={dueTone(ev.days)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ev.title}</p>
                      <p className="truncate text-xs text-ink-3">{ev.subtitle}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {ev.amount != null && (
                        <p className="mono text-xs">{formatMoney(ev.amount, ev.currency ?? currency)}</p>
                      )}
                      <p className={cn("mono text-xs", toneClass(dueTone(ev.days)))}>{dueLabel(ev.days)}</p>
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Recently added */}
        <section className="card rise i4 p-4">
          <Section label="Recently added" right={<ViewAll href="/things" />} />
          <div className="mt-3">
            {isLoading ? (
              <Empty text="Loading…" />
            ) : recent.length === 0 ? (
              <Empty text={`Nothing here yet — add your first thing (${homeDomainCount} types to choose from).`} />
            ) : (
              <ul>
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-t border-dotted border-rule-strong py-2.5 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.item_name}
                        {r.item_brand && <span className="font-normal text-ink-3"> · {r.item_brand}</span>}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-3">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {(r.location_id && locPaths.get(r.location_id)) || r.location_name || "Unfiled"}
                      </p>
                    </div>
                    <span className="meta shrink-0 text-xs">{formatDate(r.purchase_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Plans */}
        {activePlans.length > 0 && (
          <section className="card rise i4 p-4">
            <Section label="Plans" right={<ViewAll href="/plans" />} />
            <div className="mt-3 flex flex-wrap gap-2">
              {activePlans.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href="/plans"
                  className="chip bg-surface text-ink ring-rule ring-inset transition-colors hover:bg-surface-2"
                >
                  {p.title}
                  <span className="text-ink-3">· {PLAN_STATUS_LABEL[p.status]}</span>
                  {p.budget != null && <span className="mono font-medium">· {formatMoney(p.budget, currency)}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/fixit" icon={Hammer} label="Fix-it" />
        <QuickAction href="/plans" icon={Lightbulb} label="Plans" />
        <QuickAction href="/add" icon={Plus} label="Add a thing" />
        <button
          onClick={() => window.dispatchEvent(new Event("trove:command"))}
          className="card flex items-center justify-center gap-2 p-3 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-surface-2"
        >
          <Search className="h-[18px] w-[18px]" />
          Where is… ⌘K
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

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Hammer; label: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center justify-center gap-2 p-3 text-center text-xs font-semibold uppercase tracking-[0.08em] hover:bg-surface-2"
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {label}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink-3">{text}</p>;
}
