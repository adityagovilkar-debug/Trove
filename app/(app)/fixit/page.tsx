"use client";

import { useMemo, useState } from "react";
import { Plus, Check, Trash2, Hammer, MapPin, Flag } from "lucide-react";
import { toast } from "sonner";
import {
  useHomeTasks,
  useAddHomeTask,
  useToggleHomeTask,
  useDeleteHomeTask,
  useClearDoneTasks,
  useRefData,
  useLocationPaths,
} from "@/lib/queries";
import { locationOptions } from "@/lib/locations";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import type { HomeTask, TaskPriority } from "@/lib/types";

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-400",
  normal: "bg-surface-2 text-text-muted ring-border",
  low: "bg-surface-2 text-text-muted/70 ring-border",
};

// The household's shared fridge-note: things to fix or sort out around the
// house. Ownerless by design — anyone adds, anyone checks off.
export default function FixitPage() {
  const { data: tasks = [], isLoading } = useHomeTasks();
  const { data: ref } = useRefData();
  const locPaths = useLocationPaths();
  const add = useAddHomeTask();
  const toggle = useToggleHomeTask();
  const del = useDeleteHomeTask();
  const clearDone = useClearDoneTasks();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");

  const { open, done } = useMemo(() => {
    const open = tasks
      .filter((t) => !t.is_done)
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.created_at.localeCompare(a.created_at),
      );
    const done = tasks.filter((t) => t.is_done);
    return { open, done };
  }, [tasks]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    add.mutate(
      {
        title: t,
        priority,
        locationId: locationId || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setNotes("");
          setPriority("normal");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fix-it</h1>
        <p className="text-sm text-text-muted">
          Things to fix or sort out around the house. Anyone can add, anyone can check off.
        </p>
      </div>

      {/* Add */}
      <form onSubmit={submit} className="card space-y-3 p-4">
        <div className="flex gap-2">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fix hinge on balcony door"
          />
          <button className="btn-primary shrink-0" disabled={add.isPending}>
            <Plus className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            aria-label="Priority"
          >
            <option value="low">Low priority</option>
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
          </select>
          <select
            className="input"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            aria-label="Where"
          >
            <option value="">Where? (optional)</option>
            {locationOptions(ref?.locations ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="input col-span-2 sm:col-span-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="note (optional)"
          />
        </div>
      </form>

      {/* Open */}
      {isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title="Nothing to fix"
          hint="When a hinge squeaks or a switch dies, drop it here so it isn't forgotten."
        />
      ) : (
        <>
          <div className="card divide-y">
            {open.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-muted">
                All fixed — nothing open. 🔧
              </p>
            ) : (
              open.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  locationLabel={t.location_id ? locPaths.get(t.location_id) ?? null : null}
                  onToggle={() => toggle.mutate({ id: t.id, is_done: true })}
                  onDelete={() => del.mutate(t.id)}
                />
              ))
            )}
          </div>

          {done.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Done · {done.length}
                </p>
                <button
                  onClick={() => clearDone.mutate()}
                  className="text-xs text-text-muted hover:text-rose-500"
                >
                  Clear
                </button>
              </div>
              <div className="card divide-y opacity-70">
                {done.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggle.mutate({ id: t.id, is_done: false })}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"
                      aria-label="Reopen"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <p className="flex-1 truncate text-sm line-through">{t.title}</p>
                    <button
                      onClick={() => del.mutate(t.id)}
                      className="btn-ghost px-2 py-1.5 text-text-muted hover:text-rose-500"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  task: t,
  locationLabel,
  onToggle,
  onDelete,
}: {
  task: HomeTask;
  locationLabel: string | null;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <button
        onClick={onToggle}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border hover:border-brand-500"
        aria-label="Mark done"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{t.title}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          {locationLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {locationLabel}
            </span>
          )}
          {t.notes && <span className="truncate">{t.notes}</span>}
        </p>
      </div>
      {t.priority !== "normal" && (
        <span className={cn("chip shrink-0 ring-inset", PRIORITY_STYLE[t.priority])}>
          <Flag className="h-3 w-3" />
          {t.priority}
        </span>
      )}
      <button
        onClick={onDelete}
        className="btn-ghost shrink-0 px-2 py-1.5 text-text-muted hover:text-rose-500"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
