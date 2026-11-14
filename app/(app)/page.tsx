"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Flag, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useRefData,
  useShoppingList,
  useConsume,
  useSetStatus,
  useHomeTasks,
  useAddHomeTask,
  useToggleHomeTask,
  useDeleteHomeTask,
  useClearDoneTasks,
  useLocationPaths,
} from "@/lib/queries";
import { buildUpcoming, type UpcomingEvent } from "@/lib/upcoming";
import { groupIntoProducts } from "@/lib/products";
import { CheckHaveSearch } from "@/components/CheckHaveSearch";
import { Section, Led } from "@/components/instrument";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/useHydrated";

// How far ahead "Needs a look" reaches.
const FOOD_WINDOW = 7; // days
const WARRANTY_WINDOW = 30; // days

function dueText(ev: UpcomingEvent) {
  const d = ev.days;
  if (ev.kind === "warranty") {
    if (d < 0) return `warranty ended ${Math.abs(d)}d ago`;
    if (d === 0) return "warranty ends today";
    return `warranty ends in ${d}d`;
  }
  if (d < 0) return `expired ${Math.abs(d)}d ago`;
  if (d === 0) return "expires today";
  if (d === 1) return "expires tomorrow";
  return `expires in ${d}d`;
}
function tone(d: number): "bad" | "watch" | "ink" {
  if (d < 0) return "bad";
  if (d <= 3) return "watch";
  return "ink";
}

// Home is a finder, not a dashboard: one search box, then only what needs you.
export default function HomePage() {
  const hydrated = useHydrated();
  const { data: active = [], isLoading: loadingStock } = useInventory({ status: "active" });
  const isLoading = !hydrated || loadingStock;
  const { data: ref } = useRefData();
  const { data: shopping = [] } = useShoppingList();
  const locPaths = useLocationPaths();
  const consume = useConsume();
  const setStatus = useSetStatus();

  const thingCount = useMemo(() => groupIntoProducts(active).length, [active]);
  const placeCount = ref?.locations.length ?? 0;
  const toBuy = shopping.filter((s) => !s.is_bought).length;

  const attention = useMemo(
    () =>
      buildUpcoming(active).filter((e) =>
        e.kind === "expiry"
          ? e.days <= FOOD_WINDOW
          : e.days <= WARRANTY_WINDOW && e.days >= -WARRANTY_WINDOW,
      ),
    [active],
  );

  function placeOf(ev: UpcomingEvent) {
    const r = ev.inventory;
    return (r.location_id && locPaths.get(r.location_id)) || r.location_name || "no place";
  }

  return (
    <div className="pn6 mx-auto max-w-3xl space-y-6">
      <section className="rise space-y-2">
        <CheckHaveSearch large />
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-ink-3">
          <span>
            {isLoading ? "…" : `${thingCount} things · ${placeCount} places`}
          </span>
          {!isLoading && toBuy > 0 && (
            <Link href="/shopping" className="hover:text-ink">
              {toBuy} to buy ›
            </Link>
          )}
        </p>
      </section>

      {/* Needs a look */}
      <section className="rise i1 min-w-0 space-y-2">
        <Section
          label="Needs a look"
          right={
            <Link
              href="/upcoming"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
            >
              Timeline
            </Link>
          }
        />
        <div className="card px-4 py-0">
          {isLoading ? (
            <div className="space-y-2 py-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <p className="py-5 text-center text-sm text-ink-3">All clear — nothing needs you.</p>
          ) : (
            attention.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 border-t border-dotted border-rule-strong py-3 first:border-t-0"
              >
                <Led tone={tone(ev.days)} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-medium">{ev.title}</p>
                  <p className="truncate text-xs text-ink-3">
                    {placeOf(ev)} ·{" "}
                    <span className={cn("mono", ev.days < 0 ? "text-bad" : ev.days <= 3 && "text-watch")}>
                      {dueText(ev)}
                    </span>
                  </p>
                </div>
                {ev.kind === "expiry" &&
                  (ev.days < 0 ? (
                    <button
                      className="btn-outline shrink-0 px-2.5 py-1.5"
                      title="It's gone — thrown out"
                      onClick={() =>
                        setStatus.mutate(
                          { id: ev.inventory.id, status: "expired" },
                          { onSuccess: () => toast.success(`${ev.title} cleared`) },
                        )
                      }
                    >
                      Gone
                    </button>
                  ) : (
                    <button
                      className="btn-outline shrink-0 px-2.5 py-1.5"
                      title="Use one"
                      onClick={() =>
                        consume.mutate(
                          { id: ev.inventory.id, quantity: Number(ev.inventory.quantity) },
                          { onSuccess: () => toast.success(`Used 1 ${ev.title}`) },
                        )
                      }
                    >
                      <Minus className="h-4 w-4" />
                      Use 1
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      </section>

      <FixIt />
    </div>
  );
}

// The household's fix-it list, kept small: add, tick, remove — in place.
function FixIt() {
  const hydrated = useHydrated();
  const { data: tasks = [], isLoading: loadingTasks } = useHomeTasks();
  const isLoading = !hydrated || loadingTasks;
  const locPaths = useLocationPaths();
  const add = useAddHomeTask();
  const toggle = useToggleHomeTask();
  const del = useDeleteHomeTask();
  const clearDone = useClearDoneTasks();
  const [title, setTitle] = useState("");

  const open = useMemo(
    () =>
      tasks
        .filter((t) => !t.is_done)
        .sort(
          (a, b) =>
            (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1) ||
            b.created_at.localeCompare(a.created_at),
        ),
    [tasks],
  );
  const doneCount = tasks.length - open.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    add.mutate(
      { title: t, priority: "normal", locationId: null, notes: null },
      {
        onSuccess: () => setTitle(""),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add"),
      },
    );
  }

  return (
    <section className="rise i2 min-w-0 space-y-2">
      <Section
        label="Fix-it"
        right={
          isLoading ? null : doneCount > 0 ? (
            <button
              onClick={() => clearDone.mutate()}
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
            >
              Clear {doneCount} done
            </button>
          ) : (
            <span className="meta">{open.length}</span>
          )
        }
      />
      <div className="card px-4 py-0">
        {!isLoading &&
          open.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 border-t border-dotted border-rule-strong py-3 first:border-t-0"
            >
              <button
                onClick={() => toggle.mutate({ id: t.id, is_done: true })}
                className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-ink-3 hover:border-ink"
                aria-label={`Mark "${t.title}" done`}
              >
                <Check className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-sm font-medium">{t.title}</p>
                {(t.location_id || t.notes) && (
                  <p className="truncate text-xs text-ink-3">
                    {[t.location_id ? locPaths.get(t.location_id) : null, t.notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {t.priority === "high" && (
                <Flag className="h-3.5 w-3.5 shrink-0 text-bad" aria-label="High priority" />
              )}
              <button
                onClick={() => del.mutate(t.id)}
                className="btn-ghost shrink-0 px-2 py-1.5 text-text-muted hover:text-bad"
                aria-label={`Remove "${t.title}"`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        <form
          onSubmit={submit}
          className={cn(
            "flex items-center gap-3 py-2",
            open.length > 0 && "border-t border-dotted border-rule-strong",
          )}
        >
          <Plus className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a fix…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-3"
            enterKeyHint="done"
            aria-label="New fix-it"
          />
          {title.trim() && (
            <button className="btn-primary shrink-0 px-3 py-1.5" disabled={add.isPending}>
              Add
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
