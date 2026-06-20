import type { InventoryDetail } from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Pack breakdown for a single lot, e.g. "4 × 50 g", or null when the lot has
// no pack size (caller falls back to plain quantity + unit).
export function packLabel(r: {
  quantity: number;
  pack_size: number | null;
  pack_size_unit: string | null;
}): string | null {
  if (r.pack_size == null) return null;
  const size = `${round2(Number(r.pack_size))}${r.pack_size_unit ? ` ${r.pack_size_unit}` : ""}`;
  return `${round2(Number(r.quantity))} × ${size}`;
}

// Total content of a single lot, e.g. "200 g", or null when no pack size/unit.
export function packTotal(r: {
  quantity: number;
  pack_size: number | null;
  pack_size_unit: string | null;
}): string | null {
  if (r.pack_size == null || !r.pack_size_unit) return null;
  return `${round2(Number(r.quantity) * Number(r.pack_size))} ${r.pack_size_unit}`;
}

// A product groups one or more purchase *lots* of the same thing, so you can
// see total stock on hand while still drilling into each purchase.
export interface ProductGroup {
  key: string;
  itemId: string; // representative item id (for "add another purchase")
  name: string;
  brand: string | null; // single brand, or null when the group blends brands
  brands: string[]; // every distinct brand in the group (for "Lays · Balaji")
  domainId: string | null;
  domainName: string | null;
  domainKey: string | null;
  categoryName: string | null;
  totalQty: number;
  unit: string | null;
  contentLabel: string | null; // total pack content, e.g. "200 g" (null if no/mixed pack info)
  lotCount: number;
  nearestExpiryDays: number | null;
  totalValue: number;
  currency: string;
  locations: string[];
  lastPurchase: string;
  attributes: Record<string, unknown>;
  lots: InventoryDetail[]; // individual purchases, soonest-to-expire first
}

// Group lots by product, so pre-existing duplicate items merge too, not just
// future de-duplicated ones. By default groups on normalized name + domain
// (the coarse "do I have chips?" rollup). With { byBrand } the brand joins the
// key, so Lays and Balaji potato chips become separate products — the right
// granularity for price/trend comparison.
export function groupIntoProducts(
  rows: InventoryDetail[],
  opts: { byBrand?: boolean } = {},
): ProductGroup[] {
  const { byBrand = false } = opts;
  const map = new Map<string, ProductGroup>();

  for (const r of rows) {
    const base = `${r.item_name.trim().toLowerCase()}|${r.domain_id ?? ""}`;
    const key = byBrand ? `${base}|${(r.item_brand ?? "").trim().toLowerCase()}` : base;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        itemId: r.item_id,
        name: r.item_name,
        brand: r.item_brand,
        brands: [],
        domainId: r.domain_id,
        domainName: r.domain_name,
        domainKey: r.domain_key,
        categoryName: r.category_name,
        totalQty: 0,
        unit: r.unit,
        contentLabel: null,
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
    if (r.item_brand && !g.brands.includes(r.item_brand)) g.brands.push(r.item_brand);
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

  for (const g of map.values()) {
    // Don't misattribute one brand to a row that actually blends several.
    if (g.brands.length > 1) g.brand = null;
    else if (g.brands.length === 1) g.brand = g.brands[0];

    // Roll up total pack content when every lot is packed and shares a unit
    // (e.g. 4×50 g + 2×50 g → "300 g"). Mixed/absent pack info → no label.
    const packed = g.lots.filter((l) => l.pack_size != null);
    if (packed.length === g.lots.length && packed.length > 0) {
      const units = new Set(packed.map((l) => l.pack_size_unit ?? ""));
      if (units.size === 1) {
        const total = packed.reduce(
          (s, l) => s + Number(l.quantity) * Number(l.pack_size),
          0,
        );
        const u = packed[0].pack_size_unit;
        g.contentLabel = `${round2(total)}${u ? ` ${u}` : ""}`;
      }
    }

    // Sort each product's lots soonest-to-expire first (nulls last), then oldest.
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
