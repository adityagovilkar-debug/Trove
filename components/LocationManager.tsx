"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Location } from "@/lib/types";
import { locationOptions, PATH_SEP } from "@/lib/locations";

// Manage nested locations as a tree: each location can sit inside another, so
// you can record exactly where things live (Living Room › TV Unit › Left Drawer).
export function LocationManager({
  locations,
  onAdd,
  onDelete,
}: {
  locations: Location[];
  onAdd: (name: string, parentId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const options = locationOptions(locations);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), parent || null);
    setName("");
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Locations</h2>
        <p className="text-xs text-text-muted">
          Nest them to pinpoint a spot — e.g. Living Room {PATH_SEP} TV Unit {PATH_SEP} Left Drawer.
        </p>
      </div>

      <div className="space-y-0.5">
        {options.length === 0 && (
          <p className="text-sm text-text-muted">None yet.</p>
        )}
        {options.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
          >
            <span className="flex min-w-0 items-center text-sm" style={{ paddingLeft: o.depth * 16 }}>
              {o.depth > 0 && <span className="mr-1 text-text-muted">└</span>}
              <span className="truncate">{o.label.split(PATH_SEP).pop()}</span>
            </span>
            <button
              onClick={() => onDelete(o.id)}
              className="shrink-0 text-text-muted hover:text-rose-500"
              aria-label={`Delete ${o.label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
        <select
          className="input sm:max-w-[48%]"
          value={parent}
          onChange={(e) => setParent(e.target.value)}
        >
          <option value="">Top level (a room)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              Inside: {o.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New location name"
        />
        <button className="btn-outline shrink-0" aria-label="Add location">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
