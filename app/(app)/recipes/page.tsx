"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Clock, Users, ChefHat, CircleCheck, CalendarClock, X, Globe } from "lucide-react";
import { useRecipes, useInventory, useMealPlans, useDeleteMealPlan } from "@/lib/queries";
import { buildStockIndex, matchAndSort, totalMinutes } from "@/lib/recipes";
import { RecipeEditor, type RecipeSeed } from "@/components/RecipeEditor";
import { RecipeImport } from "@/components/RecipeImport";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { cn, formatDate } from "@/lib/utils";

function dayLabel(d: string) {
  const days = Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`;
}

export default function RecipesPage() {
  const { data: recipes = [], isLoading } = useRecipes();
  const { data: active = [] } = useInventory({ status: "active" });
  const { data: meals = [] } = useMealPlans();
  const delMeal = useDeleteMealPlan();
  const [search, setSearch] = useState("");
  const [cookableOnly, setCookableOnly] = useState(false);
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [seed, setSeed] = useState<RecipeSeed | undefined>(undefined);

  function newRecipe() {
    setSeed(undefined);
    setEditing(true);
  }
  function closeEditor() {
    setEditing(false);
    setSeed(undefined);
  }

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
      {editing && <RecipeEditor seed={seed} onClose={closeEditor} />}
      {importing && (
        <RecipeImport
          onClose={() => setImporting(false)}
          onPick={(r) => {
            setSeed({
              name: r.name,
              category: r.category,
              cuisine: r.area,
              instructions: r.instructions,
              ingredients: r.ingredients,
            });
            setImporting(false);
            setEditing(true);
          }}
        />
      )}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-text-muted">
            {recipes.length > 0
              ? `${cookableCount} you can cook right now from your stock.`
              : "Your home-cooked dishes."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-outline" onClick={() => setImporting(true)}>
            <Globe className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Find online</span>
          </button>
          <button className="btn-primary" onClick={newRecipe}>
            <Plus className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">New recipe</span>
          </button>
        </div>
      </div>

      {meals.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CalendarClock className="h-5 w-5 text-brand-500" />
            Planned meals
          </h2>
          <div className="divide-y">
            {meals.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/recipes/${m.recipe_id}`} className="truncate font-medium hover:underline">
                    {m.recipe_name}
                  </Link>
                  <p className="text-xs text-text-muted">
                    {formatDate(m.plan_date)} · {dayLabel(m.plan_date)}
                  </p>
                </div>
                <button
                  onClick={() => delMeal.mutate(m.id)}
                  className="btn-ghost px-2 py-1.5 text-text-muted hover:text-rose-500"
                  aria-label="Remove plan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
            <button className="btn-primary" onClick={newRecipe}>
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
                      {m.recipe.cuisine && <span>{m.recipe.cuisine}</span>}
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
                  <p className="line-clamp-2 break-words text-xs text-text-muted">
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
