"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Users,
  Pencil,
  Trash2,
  ShoppingCart,
  Check,
  Circle,
  ChefHat,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useRecipes,
  useInventory,
  useDeleteRecipe,
  useAddShoppingItems,
  useConsume,
  useAddMealPlan,
} from "@/lib/queries";
import {
  buildStockIndex,
  matchRecipe,
  totalMinutes,
  findLotForIngredient,
} from "@/lib/recipes";
import { RecipeEditor } from "@/components/RecipeEditor";
import { cn, formatDate } from "@/lib/utils";

function fmtQty(n: number) {
  return String(Math.round(n * 100) / 100);
}
function isoIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextWeekendISO() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); // upcoming Saturday
  return d.toISOString().slice(0, 10);
}

export default function RecipeDetailPage() {
  const params = useParams();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const router = useRouter();

  const { data: recipes = [], isLoading } = useRecipes();
  const { data: active = [] } = useInventory({ status: "active" });
  const del = useDeleteRecipe();
  const addShopping = useAddShoppingItems();
  const consume = useConsume();
  const addMealPlan = useAddMealPlan();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<number | null>(null); // scaled servings

  const recipe = recipes.find((r) => r.id === id);
  const stock = useMemo(() => buildStockIndex(active), [active]);
  const match = useMemo(() => (recipe ? matchRecipe(recipe, stock) : null), [recipe, stock]);

  if (isLoading)
    return <div className="p-8 text-sm text-text-muted">Loading recipe…</div>;
  if (!recipe)
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/recipes" className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Recipes
        </Link>
        <div className="card p-10 text-center text-sm text-text-muted">Recipe not found.</div>
      </div>
    );

  const mins = totalMinutes(recipe);
  const inStock = (ingId: string) => match?.have.some((h) => h.id === ingId);

  // Servings scaling: multiply ingredient quantities by target / base servings.
  const hasServings = recipe.servings != null && recipe.servings > 0;
  const base = hasServings ? recipe.servings! : 1;
  const effectiveTarget = target ?? base;
  const factor = effectiveTarget / base;

  // Missing ingredients as shopping inputs, scaled to the chosen servings.
  function missingInputs() {
    return (match?.missing ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity != null ? Math.round(i.quantity * factor * 100) / 100 : null,
      unit: i.unit,
      itemId: i.item_id,
      source: "recipe" as const,
    }));
  }

  function addMissing() {
    const inputs = missingInputs();
    if (inputs.length === 0) return;
    addShopping.mutate(inputs, {
      onSuccess: () => toast.success(`Added ${inputs.length} ingredient(s) to your shopping list`),
    });
  }

  function remove() {
    del.mutate(recipe!.id, {
      onSuccess: () => {
        toast.success("Recipe deleted");
        router.push("/recipes");
      },
    });
  }

  // Cooking decrements one of each in-stock ingredient from your stock (FIFO).
  function cookedIt() {
    if (!match) return;
    let used = 0;
    for (const ing of match.have) {
      const lot = findLotForIngredient(ing, active);
      if (lot) {
        consume.mutate({ id: lot.id, quantity: Number(lot.quantity) });
        used++;
      }
    }
    toast.success(
      used ? `Cooked! Used ${used} ingredient${used > 1 ? "s" : ""} from stock.` : "Marked as cooked.",
    );
  }

  function planMeal(planDate: string) {
    if (!recipe) return;
    const missing = match?.missing ?? [];
    addMealPlan.mutate(
      { recipeId: recipe.id, planDate },
      {
        onSuccess: () => {
          if (missing.length) addShopping.mutate(missingInputs());
          toast.success(
            `Planned for ${formatDate(planDate)}${missing.length ? ` · ${missing.length} added to list` : ""}`,
          );
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't plan"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {editing && <RecipeEditor recipe={recipe} onClose={() => setEditing(false)} />}

      <Link href="/recipes" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Recipes
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-text-muted">
            {recipe.category && <span>{recipe.category}</span>}
            {mins && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {mins} min
              </span>
            )}
            {recipe.servings && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                serves {recipe.servings}
              </span>
            )}
          </p>
          {recipe.description && <p className="mt-2 text-sm text-text-muted">{recipe.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setEditing(true)} className="btn-outline px-2.5 py-1.5" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={remove} className="btn-ghost px-2.5 py-1.5 text-rose-500" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Makeability banner */}
      {match && match.needCount > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset",
            match.canMake
              ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
              : "bg-amber-400/15 text-amber-800 ring-amber-500/30 dark:text-amber-200",
          )}
        >
          <span className="text-sm font-medium">
            {match.canMake
              ? "You have everything — ready to cook! 🍳"
              : `You have ${match.haveCount} of ${match.needCount} ingredients.`}
          </span>
          <div className="flex flex-wrap gap-2">
            {!match.canMake && (
              <button
                onClick={addMissing}
                disabled={addShopping.isPending}
                className="btn-outline px-3 py-1.5 text-xs"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Add {match.missing.length} missing
              </button>
            )}
            <button onClick={cookedIt} className="btn-primary px-3 py-1.5 text-xs">
              <ChefHat className="h-3.5 w-3.5" />
              Cooked it
            </button>
          </div>
        </div>
      )}

      {/* Plan this meal */}
      <section className="card p-4">
        <div className="mb-1 flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-brand-500" />
          <h2 className="font-semibold">Plan this meal</h2>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          We'll add any missing ingredients to your shopping list so you can shop ahead.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => planMeal(isoIn(1))} className="btn-outline px-3 py-1.5 text-sm">
            Tomorrow
          </button>
          <button onClick={() => planMeal(nextWeekendISO())} className="btn-outline px-3 py-1.5 text-sm">
            This weekend
          </button>
          <input
            type="date"
            min={isoIn(0)}
            onChange={(e) => e.target.value && planMeal(e.target.value)}
            className="input max-w-[170px]"
            aria-label="Pick a date"
          />
        </div>
      </section>

      {/* Ingredients */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Ingredients</h2>
          {recipe.ingredients.some((i) => i.quantity != null) && (
            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setTarget(Math.max(1, effectiveTarget - 1))}
                className="btn-ghost px-2 py-1"
                aria-label="Scale down"
              >
                −
              </button>
              <span className="min-w-[78px] text-center text-xs font-medium">
                {hasServings ? `Serves ${effectiveTarget}` : `${effectiveTarget}× batch`}
              </span>
              <button
                type="button"
                onClick={() => setTarget(effectiveTarget + 1)}
                className="btn-ghost px-2 py-1"
                aria-label="Scale up"
              >
                +
              </button>
            </div>
          )}
        </div>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing) => {
            const have = ing.optional ? null : inStock(ing.id);
            return (
              <li key={ing.id} className="flex items-center gap-3 text-sm">
                {ing.optional ? (
                  <Circle className="h-4 w-4 shrink-0 text-text-muted/40" />
                ) : have ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-amber-500" />
                )}
                <span className={cn("flex-1", have === false && "text-text")}>
                  {ing.quantity != null && (
                    <span className="text-text-muted">
                      {fmtQty(ing.quantity * factor)}
                      {ing.unit ? ` ${ing.unit}` : ""}{" "}
                    </span>
                  )}
                  {ing.name}
                  {ing.optional && <span className="ml-1 text-xs text-text-muted">(optional)</span>}
                </span>
                {have === false && <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">need</span>}
              </li>
            );
          })}
          {recipe.ingredients.length === 0 && (
            <li className="text-sm text-text-muted">No ingredients listed.</li>
          )}
        </ul>
      </section>

      {/* Instructions */}
      {recipe.instructions && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Method</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{recipe.instructions}</p>
        </section>
      )}
    </div>
  );
}
