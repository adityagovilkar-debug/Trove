"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
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
  Subscription,
  ShoppingItem,
} from "@/lib/types";
import { advancePayment } from "@/lib/subscriptions";
import { buildPathMap } from "@/lib/locations";
import { useMemo } from "react";

// Optimistic-update helpers: snapshot matching caches, then restore on error.
// (Offline writes apply to the cache immediately and replay on reconnect.)
type Snapshot = [QueryKey, unknown][];
function rollback(qc: QueryClient, snap: Snapshot | undefined) {
  snap?.forEach(([key, data]) => qc.setQueryData(key, data));
}

// When a consumable is used up, optionally drop it onto the shopping list
// (household setting auto_shopping). Deduped against pending items, and limited
// to consumable domains so you don't get prompted to "rebuy" a finished laptop.
const CONSUMABLE_KEYS = new Set<string | null>([null, "grocery", "household", "other"]);
async function maybeAutoShop(
  sb: ReturnType<typeof supabaseBrowser>,
  householdId: string | undefined,
  inventoryId: string,
) {
  if (!householdId) return;
  try {
    const { data: hh } = await sb
      .from("households")
      .select("auto_shopping")
      .eq("id", householdId)
      .maybeSingle();
    if (!hh?.auto_shopping) return;
    const { data: row } = await sb
      .from("inventory_detail")
      .select("item_id, item_name, domain_key")
      .eq("id", inventoryId)
      .maybeSingle();
    if (!row || !CONSUMABLE_KEYS.has(row.domain_key)) return;
    const { data: dup } = await sb
      .from("shopping_list_items")
      .select("id")
      .eq("household_id", householdId)
      .eq("is_bought", false)
      .ilike("name", row.item_name)
      .maybeSingle();
    if (dup) return;
    await sb.from("shopping_list_items").insert({
      household_id: householdId,
      name: row.item_name,
      item_id: row.item_id,
      source: "finished",
    });
  } catch {
    // best-effort; never block the main action
  }
}

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

// Map of location id → full path, derived from the cached reference data.
export function useLocationPaths() {
  const { data: ref } = useRefData();
  return useMemo(() => buildPathMap(ref?.locations ?? []), [ref?.locations]);
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

      // Reuse an existing catalog item so repurchases become new *lots* of the
      // same product (not duplicates): match by barcode first, then by name
      // within the same domain.
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
        let nameQ = sb
          .from("items")
          .select("id")
          .eq("household_id", householdId)
          .ilike("name", input.name.trim());
        nameQ = input.domainId
          ? nameQ.eq("domain_id", input.domainId)
          : nameQ.is("domain_id", null);
        const { data: byName } = await nameQ.limit(1).maybeSingle();
        itemId = byName?.id ?? null;
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
  const { data: householdId } = useHouseholdId();
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
      if (status === "finished") await maybeAutoShop(sb, householdId, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
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
  const { data: householdId } = useHouseholdId();
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
      if (next <= 0) await maybeAutoShop(sb, householdId, id);
      return { finished: next <= 0, remaining: next };
    },
    onMutate: async ({ id, quantity, amount = 1 }) => {
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const snap = qc.getQueriesData({ queryKey: ["inventory"] }) as Snapshot;
      const next = Math.max(0, Number(quantity) - amount);
      qc.setQueriesData<InventoryDetail[]>({ queryKey: ["inventory"] }, (old) =>
        !old
          ? old
          : next <= 0
            ? old.filter((r) => r.id !== id)
            : old.map((r) => (r.id === id ? { ...r, quantity: next } : r)),
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snap),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["stock-search"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
      qc.invalidateQueries({ queryKey: ["shopping"] });
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

// ---------------------------------------------------------------------------
// Subscriptions (recurring payments)
// ---------------------------------------------------------------------------
export function useSubscriptions() {
  const { data: householdId } = useHouseholdId();
  return useQuery({
    queryKey: ["subscriptions", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<Subscription[]> => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("subscriptions")
        .select("*")
        .eq("household_id", householdId!)
        .order("next_payment", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });
}

export type SubscriptionInput = Omit<
  Subscription,
  "id" | "household_id" | "created_at" | "updated_at"
> & { id?: string };

export function useUpsertSubscription() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async (input: SubscriptionInput) => {
      const sb = supabaseBrowser();
      const { id, ...fields } = input;
      if (id) {
        const { error } = await sb.from("subscriptions").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from("subscriptions")
          .insert({ household_id: householdId, ...fields });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = supabaseBrowser();
      const { error } = await sb.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

// Record a payment: advance next_payment by one billing cycle.
export function useMarkSubscriptionPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sub: Subscription) => {
      const sb = supabaseBrowser();
      const next = advancePayment(sub);
      const { error } = await sb
        .from("subscriptions")
        .update({ next_payment: next })
        .eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });
}

// ---------------------------------------------------------------------------
// Shopping list
// ---------------------------------------------------------------------------
export function useShoppingList() {
  const { data: householdId } = useHouseholdId();
  return useQuery({
    queryKey: ["shopping", householdId],
    enabled: !!householdId,
    queryFn: async (): Promise<ShoppingItem[]> => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("shopping_list_items")
        .select("*")
        .eq("household_id", householdId!)
        .order("is_bought")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShoppingItem[];
    },
  });
}

export interface ShoppingInput {
  name: string;
  note?: string | null;
  quantity?: number | null;
  unit?: string | null;
  itemId?: string | null;
  source?: ShoppingItem["source"];
}

export function useAddShoppingItems() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async (inputs: ShoppingInput[]) => {
      const sb = supabaseBrowser();
      const rows = inputs.map((i) => ({
        household_id: householdId,
        name: i.name,
        note: i.note ?? null,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        item_id: i.itemId ?? null,
        source: i.source ?? "manual",
      }));
      const { error } = await sb.from("shopping_list_items").insert(rows);
      if (error) throw error;
    },
    onMutate: async (inputs) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const snap = qc.getQueriesData({ queryKey: ["shopping"] }) as Snapshot;
      const now = new Date().toISOString();
      const temp: ShoppingItem[] = inputs.map((i, idx) => ({
        id: `temp-${Date.now()}-${idx}`,
        household_id: householdId ?? "",
        name: i.name,
        note: i.note ?? null,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        item_id: i.itemId ?? null,
        source: i.source ?? "manual",
        is_bought: false,
        bought_at: null,
        created_at: now,
      }));
      qc.setQueriesData<ShoppingItem[]>({ queryKey: ["shopping"] }, (old) => [
        ...temp,
        ...(old ?? []),
      ]);
      return { snap };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_bought }: { id: string; is_bought: boolean }) => {
      const sb = supabaseBrowser();
      const { error } = await sb
        .from("shopping_list_items")
        .update({ is_bought, bought_at: is_bought ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_bought }) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const snap = qc.getQueriesData({ queryKey: ["shopping"] }) as Snapshot;
      qc.setQueriesData<ShoppingItem[]>({ queryKey: ["shopping"] }, (old) =>
        old?.map((i) =>
          i.id === id
            ? { ...i, is_bought, bought_at: is_bought ? new Date().toISOString() : null }
            : i,
        ),
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = supabaseBrowser();
      const { error } = await sb.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const snap = qc.getQueriesData({ queryKey: ["shopping"] }) as Snapshot;
      qc.setQueriesData<ShoppingItem[]>({ queryKey: ["shopping"] }, (old) =>
        old?.filter((i) => i.id !== id),
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snap),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useClearBought() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  return useMutation({
    mutationFn: async () => {
      const sb = supabaseBrowser();
      const { error } = await sb
        .from("shopping_list_items")
        .delete()
        .eq("household_id", householdId!)
        .eq("is_bought", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}
