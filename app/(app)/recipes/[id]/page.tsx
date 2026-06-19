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
} from "lucide-react";
import { toast } from "sonner";
import {
  useRecipes,
  useInventory,
  useDeleteRecipe,
  useAddShoppingItems,
} from "@/lib/queries";
import { buildStockIndex, matchRecipe, totalMinutes } from "@/lib/recipes";
import { RecipeEditor } from "@/components/RecipeEditor";
import { cn } from "@/lib/utils";

export default function RecipeDetailPage() {
  const params = useParams();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const router = useRouter();

  const { data: recipes = [], isLoading } = useRecipes();
  const { data: active = [] } = useInventory({ status: "active" });
  const del = useDeleteRecipe();
  const addShopping = useAddShoppingItems();
  const [editing, setEditing] = useState(false);

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

  function addMissing() {
    if (!match || match.missing.length === 0) return;
    addShopping.mutate(
      match.missing.map((i) => ({ name: i.name, itemId: i.item_id, source: "recipe" as const })),
      {
        onSuccess: () =>
          toast.success(`Added ${match.missing.length} ingredient(s) to your shopping list`),
      },
    );
  }

  function remove() {
    del.mutate(recipe!.id, {
      onSuccess: () => {
        toast.success("Recipe deleted");
        router.push("/recipes");
      },
    });
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
          {!match.canMake && (
            <button
              onClick={addMissing}
              disabled={addShopping.isPending}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add {match.missing.length} missing to list
            </button>
          )}
        </div>
      )}

      {/* Ingredients */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Ingredients</h2>
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
                  {ing.quantity != null && <span className="text-text-muted">{ing.quantity}{ing.unit ? ` ${ing.unit}` : ""} </span>}
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
