// Shared domain types mirroring the Supabase schema (supabase/migrations).

export type InventoryStatus = "active" | "finished" | "expired" | "discarded";

export interface Household {
  id: string;
  name: string;
  base_currency: string;
  auto_shopping: boolean;
  created_at: string;
}

export interface Domain {
  id: string;
  household_id: string;
  key: string;
  name: string;
  icon: string | null;
  has_expiry: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  household_id: string;
  domain_id: string | null;
  name: string;
}

export interface Location {
  id: string;
  household_id: string;
  name: string;
  parent_id: string | null;
}

export interface Store {
  id: string;
  household_id: string;
  name: string;
}

export interface Item {
  id: string;
  household_id: string;
  domain_id: string | null;
  category_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  default_unit: string | null;
  attributes: Record<string, unknown>;
  image_url: string | null;
  created_at: string;
}

// Flat row from the `inventory_detail` view — the app's main read model.
export interface InventoryDetail {
  id: string;
  household_id: string;
  quantity: number;
  unit: string | null;
  pack_size: number | null; // content per unit, e.g. 50 (a 50 g packet)
  pack_size_unit: string | null; // unit of pack_size, e.g. "g"
  price: number | null;
  currency: string;
  purchase_date: string;
  expiry_date: string | null;
  opened_date: string | null;
  status: InventoryStatus;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_id: string;
  item_name: string;
  item_brand: string | null;
  item_barcode: string | null;
  item_image_url: string | null;
  item_attributes: Record<string, unknown>;
  domain_id: string | null;
  domain_key: string | null;
  domain_name: string | null;
  domain_has_expiry: boolean | null;
  category_id: string | null;
  category_name: string | null;
  location_id: string | null;
  location_name: string | null;
  store_id: string | null;
  store_name: string | null;
  days_to_expiry: number | null;
}

export type BillingCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface Subscription {
  id: string;
  household_id: string;
  name: string;
  category: string | null;
  price: number;
  currency: string;
  billing_cycle: BillingCycle;
  cycle_days: number | null;
  next_payment: string | null;
  start_date: string | null;
  payment_method: string | null;
  status: SubscriptionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  name: string;
  note: string | null;
  quantity: number | null;
  unit: string | null;
  item_id: string | null;
  source: "manual" | "restock" | "finished" | "recipe";
  is_bought: boolean;
  bought_at: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  household_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  item_id: string | null;
  optional: boolean;
  staple: boolean; // pantry staple — not auto-deducted when you cook the recipe
  sort_order: number;
}

export interface Recipe {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  category: string | null;
  cuisine: string | null;
  image_url: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[];
}

export interface MealPlan {
  id: string;
  household_id: string;
  recipe_id: string;
  plan_date: string;
  note: string | null;
  created_at: string;
}

export interface MealPlanWithRecipe extends MealPlan {
  recipe_name: string;
}

// Reference data bundled together for forms/filters.
export interface RefData {
  household: Household;
  domains: Domain[];
  categories: Category[];
  locations: Location[];
  stores: Store[];
}
