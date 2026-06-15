// Shared domain types mirroring the Supabase schema (supabase/migrations).

export type InventoryStatus = "active" | "finished" | "expired" | "discarded";

export interface Household {
  id: string;
  name: string;
  base_currency: string;
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

// Reference data bundled together for forms/filters.
export interface RefData {
  household: Household;
  domains: Domain[];
  categories: Category[];
  locations: Location[];
  stores: Store[];
}
