"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUpsertRecipe } from "@/lib/queries";
import type { RecipeWithIngredients } from "@/lib/types";

interface IngRow {
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
}

export function RecipeEditor({
  recipe,
  onClose,
  onSaved,
}: {
  recipe?: RecipeWithIngredients | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const upsert = useUpsertRecipe();

  const [name, setName] = useState(recipe?.name ?? "");
  const [category, setCategory] = useState(recipe?.category ?? "");
  const [servings, setServings] = useState(recipe?.servings ? String(recipe.servings) : "");
  const [prep, setPrep] = useState(recipe?.prep_minutes ? String(recipe.prep_minutes) : "");
  const [cook, setCook] = useState(recipe?.cook_minutes ? String(recipe.cook_minutes) : "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [rows, setRows] = useState<IngRow[]>(
    recipe?.ingredients.length
      ? recipe.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity != null ? String(i.quantity) : "",
          unit: i.unit ?? "",
          optional: i.optional,
        }))
      : [{ name: "", quantity: "", unit: "", optional: false }],
  );

  function setRow(i: number, patch: Partial<IngRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { name: "", quantity: "", unit: "", optional: false }]);
  }
  function removeRow(i: number) {
    setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the recipe a name");
    upsert.mutate(
      {
        id: recipe?.id,
        name: name.trim(),
        category: category.trim() || null,
        servings: servings ? Number(servings) : null,
        prepMinutes: prep ? Number(prep) : null,
        cookMinutes: cook ? Number(cook) : null,
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        ingredients: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            quantity: r.quantity ? Number(r.quantity) : null,
            unit: r.unit.trim() || null,
            optional: r.optional,
          })),
      },
      {
        onSuccess: (id) => {
          toast.success(recipe ? "Recipe updated" : "Recipe added");
          onSaved?.(id);
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="font-semibold">{recipe ? "Edit recipe" : "New recipe"}</p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 overflow-y-auto p-4">
          <div className="card space-y-4 p-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dal tadka" required />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="label">Category</label>
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Dinner" />
              </div>
              <div>
                <label className="label">Serves</label>
                <input className="input" type="number" min="0" value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
              <div>
                <label className="label">Prep (min)</label>
                <input className="input" type="number" min="0" value={prep} onChange={(e) => setPrep(e.target.value)} />
              </div>
              <div>
                <label className="label">Cook (min)</label>
                <input className="input" type="number" min="0" value={cook} onChange={(e) => setCook(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional one-liner" />
            </div>
          </div>

          {/* Ingredients */}
          <div className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Ingredients</p>
              <span className="text-xs text-text-muted">tick “opt.” for non-essential</span>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={row.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  placeholder="Ingredient"
                />
                <input
                  className="input w-16"
                  value={row.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                  placeholder="qty"
                  inputMode="decimal"
                />
                <input
                  className="input w-20"
                  value={row.unit}
                  onChange={(e) => setRow(i, { unit: e.target.value })}
                  placeholder="unit"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={row.optional}
                    onChange={(e) => setRow(i, { optional: e.target.checked })}
                  />
                  opt.
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="btn-ghost shrink-0 px-2 py-1.5 text-text-muted hover:text-rose-500"
                  aria-label="Remove ingredient"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addRow} className="btn-outline w-full">
              <Plus className="h-4 w-4" /> Add ingredient
            </button>
          </div>

          {/* Instructions */}
          <div className="card p-4">
            <label className="label">Instructions</label>
            <textarea
              className="input min-h-[140px] resize-y"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step method…"
            />
          </div>

          <div className="flex gap-3 pb-2">
            <button type="submit" className="btn-primary" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save recipe"}
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
