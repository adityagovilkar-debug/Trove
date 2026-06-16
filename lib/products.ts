import type { InventoryDetail } from "./types";

// A product groups one or more purchase *lots* of the same thing, so you can
// see total stock on hand while still drilling into each purchase.
export interface ProductGroup {
  key: string;
  itemId: string; // representative item id (for "add another purchase")
  name: string;
  brand: string | null;
  domainId: string | null;
  domainName: string | null;
  domainKey: string | null;
  categoryName: string | null;
  totalQty: number;
  unit: string | null;
  lotCount: number;
  nearestExpiryDays: number | null;
  totalValue: number;
  currency: string;
  locations: string[];
  lastPurchase: string;
  attributes: Record<string, unknown>;
  lots: InventoryDetail[]; // individual purchases, soonest-to-expire first
}

// Group lots by product (normalized name + domain), so pre-existing duplicate
// items merge too, not just future de-duplicated ones.
export function groupIntoProducts(rows: InventoryDetail[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();

  for (const r of rows) {
    const key = `${r.item_name.trim().toLowerCase()}|${r.domain_id ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        itemId: r.item_id,
        name: r.item_name,
        brand: r.item_brand,
        domainId: r.domain_id,
        domainName: r.domain_name,
        domainKey: r.domain_key,
        categoryName: r.category_name,
        totalQty: 0,
        unit: r.unit,
        lotCount: 0,
        nearestExpiryDays: null,
        totalValue: 0,
        currency: r.currency,
        locations: [],
        lastPurchase: r.purchase_date,
        attributes: r.item_attributes ?? {},
        lots: [],
      };
      map.set(key, g);
    }
    g.totalQty += Number(r.quantity) || 0;
    g.lotCount += 1;
    g.totalValue += Number(r.price ?? 0);
    if (r.days_to_expiry != null) {
      g.nearestExpiryDays =
        g.nearestExpiryDays == null
          ? r.days_to_expiry
          : Math.min(g.nearestExpiryDays, r.days_to_expiry);
    }
    if (r.location_name && !g.locations.includes(r.location_name))
      g.locations.push(r.location_name);
    if (r.purchase_date > g.lastPurchase) g.lastPurchase = r.purchase_date;
    g.lots.push(r);
  }

  // Sort each product's lots soonest-to-expire first (nulls last), then oldest.
  for (const g of map.values()) {
    g.lots.sort((a, b) => {
      const ax = a.days_to_expiry,
        bx = b.days_to_expiry;
      if (ax == null && bx == null)
        return a.purchase_date.localeCompare(b.purchase_date);
      if (ax == null) return 1;
      if (bx == null) return -1;
      return ax - bx;
    });
  }

  return [...map.values()];
}

// The lot to draw from when consuming one unit of a product: soonest expiry,
// then oldest purchase (FIFO).
export function lotToConsume(g: ProductGroup): InventoryDetail | undefined {
  return g.lots[0];
}
