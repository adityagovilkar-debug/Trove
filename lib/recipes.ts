import type { InventoryDetail, RecipeIngredient, RecipeWithIngredients } from "./types";

// A view of what's in stock, for matching recipe ingredients against.
export interface StockIndex {
  names: string[]; // normalized active product names
  itemIds: Set<string>; // active item ids
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

// Build the stock index from active inventory rows.
export function buildStockIndex(active: InventoryDetail[]): StockIndex {
  const names = new Set<string>();
  const itemIds = new Set<string>();
  for (const r of active) {
    names.add(norm(r.item_name));
    if (r.item_id) itemIds.add(r.item_id);
  }
  return { names: [...names], itemIds };
}

// Is this ingredient covered by current stock? Matches by linked item id, or
// by a forgiving name match (either contains the other — so "onion" matches
// "red onion", and "rice" matches "basmati rice").
export function ingredientInStock(ing: RecipeIngredient, stock: StockIndex): boolean {
  if (ing.item_id && stock.itemIds.has(ing.item_id)) return true;
  const n = norm(ing.name);
  if (!n) return false;
  return stock.names.some((p) => p === n || p.includes(n) || n.includes(p));
}

export interface RecipeMatch {
  recipe: RecipeWithIngredients;
  required: RecipeIngredient[];
  have: RecipeIngredient[];
  missing: RecipeIngredient[];
  haveCount: number;
  needCount: number;
  canMake: boolean; // every required ingredient is in stock
  ratio: number; // 0..1 of required ingredients available
}

export function matchRecipe(
  recipe: RecipeWithIngredients,
  stock: StockIndex,
): RecipeMatch {
  const required = recipe.ingredients.filter((i) => !i.optional);
  const have: RecipeIngredient[] = [];
  const missing: RecipeIngredient[] = [];
  for (const ing of required) {
    if (ingredientInStock(ing, stock)) have.push(ing);
    else missing.push(ing);
  }
  const needCount = required.length;
  const haveCount = have.length;
  return {
    recipe,
    required,
    have,
    missing,
    haveCount,
    needCount,
    canMake: needCount > 0 && missing.length === 0,
    ratio: needCount === 0 ? 0 : haveCount / needCount,
  };
}

// Sort: cookable now first, then by how close you are, then alphabetical.
export function matchAndSort(
  recipes: RecipeWithIngredients[],
  stock: StockIndex,
): RecipeMatch[] {
  return recipes
    .map((r) => matchRecipe(r, stock))
    .sort((a, b) => {
      if (a.canMake !== b.canMake) return a.canMake ? -1 : 1;
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return a.recipe.name.localeCompare(b.recipe.name);
    });
}

// The active stock lot to draw from for an ingredient when you cook a recipe:
// matched by item id or name, FIFO (soonest expiry, then oldest purchase).
export function findLotForIngredient(
  ing: RecipeIngredient,
  active: InventoryDetail[],
): InventoryDetail | undefined {
  const n = norm(ing.name);
  const matches = active.filter((r) => {
    if (ing.item_id && r.item_id === ing.item_id) return true;
    const p = norm(r.item_name);
    return p === n || p.includes(n) || n.includes(p);
  });
  matches.sort((a, b) => {
    const ax = a.days_to_expiry;
    const bx = b.days_to_expiry;
    if (ax == null && bx == null) return a.purchase_date.localeCompare(b.purchase_date);
    if (ax == null) return 1;
    if (bx == null) return -1;
    return ax - bx;
  });
  return matches[0];
}

export function totalMinutes(r: { prep_minutes: number | null; cook_minutes: number | null }) {
  const t = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
  return t > 0 ? t : null;
}
