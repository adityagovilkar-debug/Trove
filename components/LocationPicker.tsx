"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, ChevronDown, X, Plus, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { useRefData, useLocationPaths, useCreateLocation } from "@/lib/queries";
import { locationOptions, PATH_SEP } from "@/lib/locations";
import { cn } from "@/lib/utils";

const RECENTS_KEY = "trove-recent-locations";

function readRecents(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// A friendlier way to assign a location than a giant nested <select>: browse
// your recently-used spots and the tree, search anywhere in a path ("draw"
// finds every drawer), and create a new spot inline without leaving the form.
export function LocationPicker({
  value,
  onChange,
  placeholder = "Kept in…",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const { data: ref } = useRefData();
  const locPaths = useLocationPaths();
  const create = useCreateLocation();

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newParent, setNewParent] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Open upward when the field sits low (e.g. near the bottom of a scrollable
  // dialog) so the dropdown isn't clipped.
  function toggleOpen() {
    setOpen((was) => {
      if (!was) {
        const r = triggerRef.current?.getBoundingClientRect();
        if (r) setDropUp(window.innerHeight - r.bottom < 320 && r.top > 320);
      }
      return !was;
    });
  }

  const options = useMemo(() => locationOptions(ref?.locations ?? []), [ref?.locations]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => setRecents(readRecents()), [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectedLabel = value ? locPaths.get(value) ?? byId.get(value)?.label ?? "" : "";
  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;
  // Only offer "create" when nothing matches the leaf name exactly.
  const exact = options.some((o) => o.label.split(PATH_SEP).pop()?.toLowerCase() === q);
  const recentOpts = recents.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o);

  function choose(id: string | null) {
    onChange(id ?? "");
    if (id) pushRecent(id);
    setOpen(false);
    setQuery("");
    setCreating(false);
  }

  function doCreate() {
    const name = query.trim();
    if (!name) return;
    create.mutate(
      { name, parentId: newParent || null },
      {
        onSuccess: (loc) => {
          toast.success(`Added location “${name}”`);
          choose(loc.id);
          setNewParent("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't create"),
      },
    );
  }

  return (
    <div ref={boxRef} className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="input flex w-full items-center gap-2 text-left"
      >
        <MapPin className="h-4 w-4 shrink-0 text-text-muted" />
        <span className={cn("flex-1 truncate", !value && "text-text-muted/70")}>
          {selectedLabel || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              choose(null);
            }}
            className="rounded p-0.5 text-text-muted hover:bg-surface-2"
            aria-label="Clear location"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-40 overflow-hidden rounded-xl border bg-surface shadow-xl",
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {/* Search */}
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCreating(false);
              }}
              placeholder="Search or add a spot…"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none"
            />
          </div>

          <div className="max-h-72 overflow-auto p-1">
            {/* Recents (browse mode only) */}
            {!q && recentOpts.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  Recent
                </p>
                <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                  {recentOpts.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => choose(o.id)}
                      className="chip bg-surface-2 text-text-muted ring-border ring-inset hover:text-text"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  All spots
                </p>
              </>
            )}

            {/* Tree / matches */}
            {matches.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => choose(o.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2",
                  value === o.id && "bg-surface-2 font-medium",
                )}
                style={{ paddingLeft: q ? undefined : 8 + o.depth * 14 }}
              >
                {!q && o.depth > 0 && (
                  <CornerDownRight className="h-3 w-3 shrink-0 text-text-muted/60" />
                )}
                <span className="truncate">
                  {q ? o.label : o.label.split(PATH_SEP).pop()}
                </span>
                {q && o.depth > 0 && (
                  <span className="ml-auto truncate text-xs text-text-muted">
                    {o.label.split(PATH_SEP).slice(0, -1).join(PATH_SEP)}
                  </span>
                )}
              </button>
            ))}

            {matches.length === 0 && !q && (
              <p className="px-2 py-3 text-center text-xs text-text-muted">
                No locations yet — type a name below to add your first.
              </p>
            )}

            {/* Create inline */}
            {q && !exact && (
              <div className="mt-1 border-t pt-1">
                {!creating ? (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-brand-700 hover:bg-surface-2 dark:text-brand-300"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    Create “{query.trim()}”
                  </button>
                ) : (
                  <div className="space-y-2 p-2">
                    <p className="text-xs text-text-muted">
                      Add “{query.trim()}” — where does it sit?
                    </p>
                    <select
                      className="input"
                      value={newParent}
                      onChange={(e) => setNewParent(e.target.value)}
                    >
                      <option value="">Top level (a room)</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          Inside: {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={doCreate}
                        disabled={create.isPending}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        {create.isPending ? "Adding…" : "Add & select"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreating(false)}
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
