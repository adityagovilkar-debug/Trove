import type { InventoryDetail, RecipeIngredient } from "./types";
import { findLotForIngredient } from "./recipes";

// Lightweight unit reconciliation so recipe quantities become *purchasable*
// quantities on the shopping list. Recipes speak in cooking units (2 cups),
// stock speaks in packs (a 1 kg bag) — this bridges the two where it can, and
// falls back to "buy one pack" when the dimensions don't line up (you can't
// convert cups of rice to kilograms without a density table, and shouldn't try).

type Dim = "volume" | "mass" | "count";

const VOLUME: Record<string, number> = {
  ml: 1, milliliter: 1, millilitre: 1,
  l: 1000, liter: 1000, litre: 1000,
  tsp: 5, teaspoon: 5,
  tbsp: 15, tablespoon: 15, tbl: 15, tbls: 15,
  cup: 240,
  pint: 473, quart: 946, gallon: 3785,
};
const MASS: Record<string, number> = {
  mg: 0.001, g: 1, gram: 1, gm: 1,
  kg: 1000, kilogram: 1000,
  oz: 28.35, ounce: 28.35,
  lb: 453.6, pound: 453.6,
};
const COUNT: Record<string, number> = {
  pcs: 1, pc: 1, piece: 1, each: 1, no: 1, nos: 1,
  dozen: 12,
  pack: 1, packet: 1, bottle: 1, can: 1, box: 1, jar: 1,
  bunch: 1, clove: 1, slice: 1, tin: 1, sachet: 1,
};

// Convert an amount to a base dimension (ml / g / count), or null for an
// unrecognised unit. A missing unit is treated as a count.
export function toBase(
  quantity: number,
  unit: string | null | undefined,
): { dim: Dim; value: number } | null {
  if (!unit) return { dim: "count", value: quantity };
  const u = unit.trim().toLowerCase();
  for (const c of [u, u.replace(/s$/, "")]) {
    if (c in VOLUME) return { dim: "volume", value: quantity * VOLUME[c] };
    if (c in MASS) return { dim: "mass", value: quantity * MASS[c] };
    if (c in COUNT) return { dim: "count", value: quantity * COUNT[c] };
  }
  return null;
}

// Turn a recipe ingredient into a quantity you can actually buy, using how the
// product is stocked as the reference for what "one pack" contains.
export function shoppingQtyForIngredient(
  ing: RecipeIngredient,
  active: InventoryDetail[],
): { quantity: number | null; unit: string | null } {
  const lot = findLotForIngredient(ing, active);
  // No stock reference at all → keep the recipe's own terms.
  if (!lot) return { quantity: ing.quantity, unit: ing.unit };

  const packNoun = lot.unit ?? "pack";
  // What one purchasable unit contains, in a base dimension.
  const packContent =
    lot.pack_size != null && lot.pack_size_unit
      ? toBase(Number(lot.pack_size), lot.pack_size_unit)
      : lot.unit
        ? toBase(1, lot.unit)
        : null;
  const need = ing.quantity != null ? toBase(Number(ing.quantity), ing.unit) : null;

  if (need && packContent && need.dim === packContent.dim && packContent.value > 0) {
    const packs = Math.max(1, Math.ceil(need.value / packContent.value));
    return { quantity: packs, unit: packNoun };
  }
  // Known product, but units don't reconcile (2 cups rice vs a 1 kg bag) —
  // just buy one of however it's stocked.
  return { quantity: 1, unit: packNoun };
}
