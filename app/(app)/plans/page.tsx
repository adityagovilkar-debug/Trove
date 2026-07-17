"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Lightbulb,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePlans,
  useUpsertPlan,
  useSetPlanStatus,
  useDeletePlan,
  useRefData,
} from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { cn, formatMoney } from "@/lib/utils";
import type { Plan, PlanStatus } from "@/lib/types";

const LANES: { key: PlanStatus; label: string }[] = [
  { key: "idea", label: "Ideas" },
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const CATEGORIES = ["Renovation", "Major purchase", "Improvement", "Other"];

// The ideas board for the house: renovations and major purchases moving
// through Idea → Planned → In progress → Done, with a rough budget.
export default function PlansPage() {
  const { data: plans = [], isLoading } = usePlans();
  const { data: ref } = useRefData();
  const setStatus = useSetPlanStatus();
  const del = useDeletePlan();
  const [dialog, setDialog] = useState<{ open: boolean; plan?: Plan | null }>({
    open: false,
  });
  const currency = ref?.household.base_currency ?? "INR";

  const byLane = useMemo(() => {
    const m = new Map<PlanStatus, Plan[]>(LANES.map((l) => [l.key, []]));
    for (const p of plans) (m.get(p.status) ?? m.get("idea")!).push(p);
    return m;
  }, [plans]);

  function move(p: Plan, dir: 1 | -1) {
    const idx = LANES.findIndex((l) => l.key === p.status);
    const next = LANES[idx + dir];
    if (!next) return;
    setStatus.mutate(
      { id: p.id, status: next.key },
      { onSuccess: () => toast.success(`Moved to ${next.label}`) },
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {dialog.open && (
        <PlanDialog plan={dialog.plan} currency={currency} onClose={() => setDialog({ open: false })} />
      )}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-text-muted">
            Renovations, big purchases, and someday-ideas for the house.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setDialog({ open: true, plan: null })}>
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">New plan</span>
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No plans yet"
          hint="New cupboards? Rework the balcony? Park the idea here with a rough budget, and move it along as it happens."
          action={
            <button className="btn-primary" onClick={() => setDialog({ open: true, plan: null })}>
              <Plus className="h-4 w-4" /> Add your first plan
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LANES.map((lane) => {
            const items = byLane.get(lane.key) ?? [];
            return (
              <section key={lane.key} className="space-y-2">
                <h2 className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {lane.label}
                  <span className="font-normal normal-case">{items.length}</span>
                </h2>
                <div className={cn("space-y-2", lane.key === "done" && "opacity-70")}>
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-text-muted">
                      —
                    </div>
                  ) : (
                    items.map((p) => (
                      <div key={p.id} className="card space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 break-words font-medium">{p.title}</p>
                          {p.budget != null && (
                            <span className="shrink-0 text-sm font-medium text-text">
                              {formatMoney(p.budget, currency)}
                            </span>
                          )}
                        </div>
                        {(p.category || p.notes) && (
                          <p className="line-clamp-2 break-words text-xs text-text-muted">
                            {[p.category, p.notes].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between border-t pt-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => move(p, -1)}
                              disabled={lane.key === "idea"}
                              className="btn-ghost px-2 py-1 disabled:opacity-30"
                              title="Move back"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => move(p, 1)}
                              disabled={lane.key === "done"}
                              className="btn-ghost px-2 py-1 disabled:opacity-30"
                              title="Move forward"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDialog({ open: true, plan: p })}
                              className="btn-ghost px-2 py-1"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => del.mutate(p.id)}
                              className="btn-ghost px-2 py-1 text-text-muted hover:text-rose-500"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanDialog({
  plan,
  currency,
  onClose,
}: {
  plan?: Plan | null;
  currency: string;
  onClose: () => void;
}) {
  const upsert = useUpsertPlan();
  const [title, setTitle] = useState(plan?.title ?? "");
  const [category, setCategory] = useState(plan?.category ?? "");
  const [status, setStatusVal] = useState<PlanStatus>(plan?.status ?? "idea");
  const [budget, setBudget] = useState(plan?.budget != null ? String(plan.budget) : "");
  const [notes, setNotes] = useState(plan?.notes ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Give the plan a name");
    upsert.mutate(
      {
        id: plan?.id,
        title: title.trim(),
        category: category || null,
        status,
        budget: budget ? Number(budget) : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(plan ? "Plan updated" : "Plan added");
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="font-semibold">{plan ? "Edit plan" : "New plan"}</p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 p-4">
          <div>
            <label className="label">What's the plan? *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rework the balcony"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatusVal(e.target.value as PlanStatus)}
              >
                {LANES.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rough budget ({currency})</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[72px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="links, measurements, anything worth remembering"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save plan"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
