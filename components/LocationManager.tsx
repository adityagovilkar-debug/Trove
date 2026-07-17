"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, FolderInput, Check, X, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import {
  useRefData,
  useInventory,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from "@/lib/queries";
import { locationOptions, PATH_SEP } from "@/lib/locations";

// Manage the location tree: rename in place, move a spot into another, add a
// child on any row, and see how many things live in each. Deleting a spot
// promotes its children up a level and unfiles its items (nothing is lost).
export function LocationManager() {
  const { data: ref } = useRefData();
  const { data: active = [] } = useInventory({ status: "active" });
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const del = useDeleteLocation();

  const locations = useMemo(() => ref?.locations ?? [], [ref?.locations]);
  const options = useMemo(() => locationOptions(locations), [locations]);

  // How many active things sit directly in each location.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of active) if (r.location_id) m.set(r.location_id, (m.get(r.location_id) ?? 0) + 1);
    return m;
  }, [active]);

  // Descendants of a node (to forbid moving a spot into its own subtree).
  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of locations) {
      if (!l.parent_id) continue;
      (m.get(l.parent_id) ?? m.set(l.parent_id, []).get(l.parent_id)!).push(l.id);
    }
    return m;
  }, [locations]);
  function descendants(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenOf.get(cur) ?? []) {
        if (!out.has(c)) {
          out.add(c);
          stack.push(c);
        }
      }
    }
    return out;
  }

  const [addName, setAddName] = useState("");
  const [addParent, setAddParent] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [moving, setMoving] = useState<string | null>(null);

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = addName.trim();
    if (!name) return;
    create.mutate(
      { name, parentId: addParent || null },
      {
        onSuccess: () => {
          setAddName("");
          setAddParent("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add"),
      },
    );
  }

  function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return setEditing(null);
    update.mutate(
      { id, name },
      {
        onSuccess: () => setEditing(null),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't rename"),
      },
    );
  }

  function move(id: string, parentId: string | null) {
    update.mutate(
      { id, parentId },
      {
        onSuccess: () => {
          setMoving(null);
          toast.success("Moved");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't move"),
      },
    );
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Locations</h2>
        <p className="text-xs text-text-muted">
          Where things are kept. Nest them to pinpoint a spot — e.g. Living Room {PATH_SEP} TV Unit{" "}
          {PATH_SEP} Left Drawer. Deleting one keeps its contents (children move up, items become unfiled).
        </p>
      </div>

      <div className="space-y-0.5">
        {options.length === 0 && <p className="text-sm text-text-muted">None yet.</p>}
        {options.map((o) => {
          const leaf = o.label.split(PATH_SEP).pop() ?? o.label;
          const count = counts.get(o.id) ?? 0;
          const blocked = new Set([o.id, ...descendants(o.id)]);
          return (
            <div key={o.id} className="rounded-lg px-2 py-1.5 hover:bg-surface-2">
              {editing === o.id ? (
                <div className="flex items-center gap-2" style={{ paddingLeft: o.depth * 16 }}>
                  <input
                    className="input h-8 py-1"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(o.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button onClick={() => saveRename(o.id)} className="btn-primary px-2 py-1" aria-label="Save">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-ghost px-2 py-1" aria-label="Cancel">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="flex min-w-0 flex-1 items-center gap-1 text-sm"
                    style={{ paddingLeft: o.depth * 16 }}
                  >
                    {o.depth > 0 && <CornerDownRight className="h-3 w-3 shrink-0 text-text-muted/60" />}
                    <span className="truncate">{leaf}</span>
                    {count > 0 && (
                      <span className="ml-1 shrink-0 text-xs text-text-muted">· {count}</span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconBtn
                      title="Rename"
                      onClick={() => {
                        setEditing(o.id);
                        setEditName(leaf);
                        setMoving(null);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Move into…"
                      onClick={() => {
                        setMoving(moving === o.id ? null : o.id);
                        setEditing(null);
                      }}
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Add a spot inside"
                      onClick={() => {
                        setAddParent(o.id);
                        setAddName("");
                        document.getElementById("loc-add-name")?.focus();
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Delete" danger onClick={() => del.mutate(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              )}

              {moving === o.id && (
                <div className="mt-1.5 flex items-center gap-2" style={{ paddingLeft: o.depth * 16 }}>
                  <select
                    className="input h-8 py-1"
                    defaultValue=""
                    onChange={(e) => move(o.id, e.target.value || null)}
                    aria-label="Move into"
                  >
                    <option value="">Move to… (top level)</option>
                    {options
                      .filter((t) => !blocked.has(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          Inside: {t.label}
                        </option>
                      ))}
                  </select>
                  <button onClick={() => setMoving(null)} className="btn-ghost px-2 py-1" aria-label="Cancel">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={submitAdd} className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
        <select
          className="input sm:max-w-[46%]"
          value={addParent}
          onChange={(e) => setAddParent(e.target.value)}
        >
          <option value="">Top level (a room)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              Inside: {o.label}
            </option>
          ))}
        </select>
        <input
          id="loc-add-name"
          className="input"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="New spot name"
        />
        <button className="btn-outline shrink-0" aria-label="Add location" disabled={create.isPending}>
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`rounded-md p-1.5 text-text-muted hover:bg-surface ${danger ? "hover:text-rose-500" : "hover:text-text"}`}
    >
      {children}
    </button>
  );
}
