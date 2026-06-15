"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type {
  Category,
  Domain,
  InventoryDetail,
  InventoryStatus,
  Item,
  Location,
  RefData,
  Store,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Household resolution — every query is scoped to the signed-in user's
// household. We resolve it once and cache it.
// ---------------------------------------------------------------------------
export function useHouseholdId() {
  return useQuery({
    queryKey: ["household-id"],
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await sb
        .from("household_members")
        .select("household_id")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (error) throw error;
      return data.household_id as string;
    },
  });
}

// ---------------------------------------------------------------------------
// Reference data (household, domains, categories, locations, stores)
// ---------------------------------------------------------------------------
export function useRefData() {
  const { data: householdId } = useHouseholdId();
  return useQuery({
    queryKey: ["ref-data", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<RefData> => {
      const sb = supabaseBrowser();
      const [household, domains, categories, locations, stores] =
        await Promise.all([
          sb.from("households").select("*").eq("id", householdId!).single(),
          sb
            .from("domains")
            .select("*")
            .eq("household_id", householdId!)
            .order("sort_order"),
          sb
            .from("categories")
            .select("*")
            .eq("household_id", householdId!)
            .order("name"),
          sb
            .from("locations")
            .select("*")
            .eq("household_id", householdId!)
            .order("name"),
          sb
            .from("stores")
            .select("*")
            .eq("household_id", householdId!)
            .order("name"),
        ]);
      const err =
        household.error ||
        domains.error ||
        categories.error ||
        locations.error ||
        stores.error;
      if (err) throw err;
      return {
        household: household.data,
        domains: (domains.data ?? []) as Domain[],
        categories: (categories.data ?? []) as Category[],
        locations: (locations.data ?? []) as Location[],
        stores: (stores.data ?? []) as Store[],
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Inventory (the flat read-model view)
// ---------------------------------------------------------------------------
export interface InventoryFilters {
  status?: InventoryStatus | "all";
  domainId?: string | null;
  search?: string;
}

export function useInventory(filters: InventoryFilters = {}) {
  const { data: householdId } = useHouseholdId();
  const { status = "active", domainId, search } = filters;
  return useQuery({
    queryKey: ["inventory", householdId, status, domainId, search ?? ""],
    enabled: !!householdId,
    queryFn: async (): Promise<InventoryDetail[]> => {
      const sb = supabaseBrowser();
      let q = sb
        .from("inventory_detail")
        .select("*")
        .eq("household_id", householdId!);
      if (status !== "all") q = q.eq("status", status);
      if (domainId) q = q.eq("domain_id", domainId);
      if (search && search.trim())
        q = q.ilike("item_name", `%${search.trim()}%`);
      q = q.order("expiry_date", { ascending: true, nullsFirst: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InventoryDetail[];
    },
  });
}

// "Do I have this?" — search across ALL active stock by name/brand.
export function useStockSearch(term: string) {
  const { data: householdId } = useHouseholdId();
  const trimmed = term.trim();
  return useQuery({
    queryKey: ["stock-search", householdId, trimmed],
    enabled: !!householdId && trimmed.length >= 1,
    queryFn: async (): Promise<InventoryDetail[]> => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("inventory_detail")
        .select("*")
        .eq("household_id", householdId!)
        .eq("status", "active")
        .or(`item_name.ilike.%${trimmed}%,item_brand.ilike.%${trimmed}%`)
        .order("item_name");
      if (error) throw error;
      return (data ?? []) as InventoryDetail[];
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export interface AddStockInput {
  // item (catalog)
  name: string;
  brand?: string | null;
  barcode?: string | null;
  domainId?: string | null;
  categoryId?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, unknown>;
  // stock row
  quantity: number;
  unit?: string | null;
  price?: number | null;
  currency?: string;
  purchaseDate?: string;
  expiryDate?: string | null;
  locationId?: string | null;
  storeName?: string | null; // free-typed; resolved/created to a store row
  notes?: string | null;
}

export function useAddStock() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async (input: AddStockInput) => {
      const sb = supabaseBrowser();
      if (!householdId) throw new Error("No household");
      const { data: auth } = await sb.auth.getUser();

      // Reuse an existing catalog item by barcode or (name+brand), else make one.
      let itemId: string | null = null;
      if (input.barcode) {
        const { data: existing } = await sb
          .from("items")
          .select("id")
          .eq("household_id", householdId)
          .eq("barcode", input.barcode)
          .maybeSingle();
        itemId = existing?.id ?? null;
      }
      if (!itemId) {
        const { data: item, error: itemErr } = await sb
          .from("items")
          .insert({
            household_id: householdId,
            name: input.name,
            brand: input.brand ?? null,
            barcode: input.barcode ?? null,
            domain_id: input.domainId ?? null,
            category_id: input.categoryId ?? null,
            image_url: input.imageUrl ?? null,
            attributes: input.attributes ?? {},
          })
          .select("id")
          .single();
        if (itemErr) throw itemErr;
        itemId = (item as Item).id;
      }

      // Resolve store name to a store row (create on first use).
      let storeId: string | null = null;
      if (input.storeName?.trim()) {
        const name = input.storeName.trim();
        const { data: s } = await sb
          .from("stores")
          .select("id")
          .eq("household_id", householdId)
          .ilike("name", name)
          .maybeSingle();
        if (s?.id) storeId = s.id;
        else {
          const { data: ns, error: nsErr } = await sb
            .from("stores")
            .insert({ household_id: householdId, name })
            .select("id")
            .single();
          if (nsErr) throw nsErr;
          storeId = (ns as Store).id;
        }
      }

      const { error: invErr } = await sb.from("inventory").insert({
        household_id: householdId,
        item_id: itemId,
        location_id: input.locationId ?? null,
        store_id: storeId,
        quantity: input.quantity,
        unit: input.unit ?? null,
        price: input.price ?? null,
        currency: input.currency ?? "INR",
        purchase_date: input.purchaseDate ?? new Date().toISOString().slice(0, 10),
        expiry_date: input.expiryDate ?? null,
        notes: input.notes ?? null,
        created_by: auth.user?.id ?? null,
      });
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["ref-data"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}

// Flip a stock row's status (finished / expired / discarded / reactivate).
export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: InventoryStatus;
    }) => {
      const sb = supabaseBrowser();
      const { error } = await sb
        .from("inventory")
        .update({
          status,
          finished_at:
            status === "active" ? null : new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}

export interface UpdateStockInput {
  id: string; // inventory row id
  itemId: string;
  name: string;
  brand?: string | null;
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  quantity: number;
  unit?: string | null;
  price?: number | null;
  expiryDate?: string | null;
  purchaseDate?: string;
  locationId?: string | null;
  storeName?: string | null;
  notes?: string | null;
}

// Edit an existing entry: updates both the catalog item (name/brand/category/
// attributes) and the physical stock row.
export function useUpdateStock() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async (input: UpdateStockInput) => {
      const sb = supabaseBrowser();

      const { error: itemErr } = await sb
        .from("items")
        .update({
          name: input.name,
          brand: input.brand ?? null,
          category_id: input.categoryId ?? null,
          attributes: input.attributes ?? {},
        })
        .eq("id", input.itemId);
      if (itemErr) throw itemErr;

      // Resolve a typed store name to a store row (create on first use).
      let storeId: string | null = null;
      if (input.storeName?.trim() && householdId) {
        const name = input.storeName.trim();
        const { data: s } = await sb
          .from("stores")
          .select("id")
          .eq("household_id", householdId)
          .ilike("name", name)
          .maybeSingle();
        if (s?.id) storeId = s.id;
        else {
          const { data: ns, error: nsErr } = await sb
            .from("stores")
            .insert({ household_id: householdId, name })
            .select("id")
            .single();
          if (nsErr) throw nsErr;
          storeId = (ns as Store).id;
        }
      }

      const { error: invErr } = await sb
        .from("inventory")
        .update({
          location_id: input.locationId ?? null,
          store_id: storeId,
          quantity: input.quantity,
          unit: input.unit ?? null,
          price: input.price ?? null,
          expiry_date: input.expiryDate ?? null,
          purchase_date: input.purchaseDate,
          notes: input.notes ?? null,
        })
        .eq("id", input.id);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["ref-data"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}

// Consume part of a stock row (e.g. drink one of four bottles). Decrements
// the quantity; when it reaches zero the row auto-finishes so the inventory
// list stays clean instead of accumulating one entry per unit.
export function useConsume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      quantity,
      amount = 1,
    }: {
      id: string;
      quantity: number;
      amount?: number;
    }) => {
      const sb = supabaseBrowser();
      const next = Math.max(0, Number(quantity) - amount);
      const patch =
        next <= 0
          ? { quantity: 0, status: "finished", finished_at: new Date().toISOString() }
          : { quantity: next };
      const { error } = await sb.from("inventory").update(patch).eq("id", id);
      if (error) throw error;
      return { finished: next <= 0, remaining: next };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = supabaseBrowser();
      const { error } = await sb.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
    },
  });
}

// Generic helper to add a reference row (location/store/category).
export function useAddRef(
  table: "locations" | "stores" | "categories",
) {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const sb = supabaseBrowser();
      const { error } = await sb
        .from(table)
        .insert({ household_id: householdId, ...payload });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ref-data"] }),
  });
}

// ---------------------------------------------------------------------------
// Trends — all finished/active history for analytics. Aggregation happens
// client-side in the trends page so we can slice it flexibly.
// ---------------------------------------------------------------------------
export function useTrendsData() {
  const { data: householdId } = useHouseholdId();
  return useQuery({
    queryKey: ["trends", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<InventoryDetail[]> => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("inventory_detail")
        .select("*")
        .eq("household_id", householdId!)
        .order("purchase_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InventoryDetail[];
    },
  });
}
