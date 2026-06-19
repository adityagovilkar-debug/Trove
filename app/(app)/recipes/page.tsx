"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Clock, Users, ChefHat, CircleCheck } from "lucide-react";
import { useRecipes, useInventory } from "@/lib/queries";
import { buildStockIndex, matchAndSort, totalMinutes } from "@/lib/recipes";
import { RecipeEditor } from "@/components/RecipeEditor";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { cn } from "@/lib/utils";

export default function RecipesPage() {
  const { data: recipes = [], isLoading } = useRecipes();
  const { data: active = [] } = useInventory({ status: "active" });
  const [search, setSearch] = useState("");
  const [cookableOnly, setCookableOnly] = useState(false);
  const [editing, setEditing] = useState(false);

  const stock = useMemo(() => buildStockIndex(active), [active]);
  const matches = useMemo(() => matchAndSort(recipes, stock), [recipes, stock]);
  const cookableCount = matches.filter((m) => m.canMake).length;

  const visible = matches.filter((m) => {
    if (cookableOnly && !m.canMake) return false;
    const q = search.trim().toLowerCase();
    return !q || m.recipe.name.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {editing && <RecipeEditor onClose={() => setEditing(false)} />}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-text-muted">
            {recipes.length > 0
              ? `${cookableCount} you can cook right now from your stock.`
              : "Your home-cooked dishes."}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(true)}>
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">New recipe</span>
        </button>
      </div>

      {recipes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes…"
              className="input pl-10"
            />
          </div>
          <button
            onClick={() => setCookableOnly((v) => !v)}
            className={cn(
              "chip ring-inset transition-colors",
              cookableOnly
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-surface text-text-muted ring-border hover:text-text",
            )}
          >
            <CircleCheck className="h-3.5 w-3.5" />
            Cookable now
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonRows n={4} />
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No recipes yet"
          hint="Add your home-cooked dishes and Trove will tell you which ones you can make from what's in stock."
          action={
            <button className="btn-primary" onClick={() => setEditing(true)}>
              <Plus className="h-4 w-4" /> Add your first recipe
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title="No matches" hint="Try a different search or turn off the filter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((m) => {
            const mins = totalMinutes(m.recipe);
            return (
              <Link key={m.recipe.id} href={`/recipes/${m.recipe.id}`} className="card flex flex-col gap-2 p-4 transition-colors hover:bg-surface-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.recipe.name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                      {m.recipe.category && <span>{m.recipe.category}</span>}
                      {mins && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {mins}m
                        </span>
                      )}
                      {m.recipe.servings && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {m.recipe.servings}
                        </span>
                      )}
                    </p>
                  </div>
                  {m.canMake ? (
                    <span className="chip shrink-0 bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 ring-inset dark:text-emerald-400">
                      <CircleCheck className="h-3 w-3" /> Ready
                    </span>
                  ) : (
                    <span className="chip shrink-0 bg-amber-400/15 text-amber-700 ring-amber-500/30 ring-inset dark:text-amber-300">
                      {m.haveCount}/{m.needCount}
                    </span>
                  )}
                </div>
                {!m.canMake && m.missing.length > 0 && (
                  <p className="truncate text-xs text-text-muted">
                    Missing: {m.missing.map((i) => i.name).join(", ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
