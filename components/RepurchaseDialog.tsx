"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAddStock, useRefData } from "@/lib/queries";
import type { ProductGroup } from "@/lib/products";
import type { InventoryDetail, ShoppingItem } from "@/lib/types";
import { locationOptions } from "@/lib/locations";

const UNITS = ["pcs", "pack", "g", "kg", "ml", "L", "bottle", "can", "box", "dozen"];
const PACK_UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];
const today = () => new Date().toISOString().slice(0, 10);

// Everything needed to log a fresh purchase of something you already track.
// `itemId` (when known) attaches the new lot to the exact same catalog item, so
// brand and price history stay intact.
export interface RepurchaseSeed {
  itemId?: string | null;
  name: string;
  brand?: string | null;
  domainId?: string | null;
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  barcode?: string | null;
  unit?: string | null;
  currency: string;
  locationId?: string | null;
  storeName?: string | null;
  hasExpiry?: boolean;
  packSize?: number | null;
  packSizeUnit?: string | null;
  defaultQty?: string;
}

export function seedFromProduct(g: ProductGroup): RepurchaseSeed {
  const rep = g.lots[0];
  return {
    itemId: g.itemId,
    name: g.name,
    brand: g.brand,
    domainId: g.domainId,
    categoryId: rep?.category_id ?? null,
    attributes: g.attributes,
    barcode: rep?.item_barcode ?? null,
    unit: g.unit ?? rep?.unit ?? "pcs",
    currency: g.currency,
    locationId: rep?.location_id ?? null,
    storeName: rep?.store_name ?? null,
    hasExpiry: rep?.domain_has_expiry ?? true,
    packSize: rep?.pack_size ?? null,
    packSizeUnit: rep?.pack_size_unit ?? null,
  };
}

export function seedFromLot(row: InventoryDetail): RepurchaseSeed {
  return {
    itemId: row.item_id,
    name: row.item_name,
    brand: row.item_brand,
    domainId: row.domain_id,
    categoryId: row.category_id,
    attributes: row.item_attributes,
    barcode: row.item_barcode,
    unit: row.unit ?? "pcs",
    currency: row.currency,
    locationId: row.location_id,
    storeName: row.store_name,
    hasExpiry: row.domain_has_expiry ?? true,
    packSize: row.pack_size,
    packSizeUnit: row.pack_size_unit,
  };
}

export function seedFromShopping(it: ShoppingItem, currency: string): RepurchaseSeed {
  return {
    itemId: it.item_id,
    name: it.name,
    unit: it.unit ?? "pcs",
    currency,
    hasExpiry: true,
    defaultQty: it.quantity != null ? String(it.quantity) : "1",
  };
}

export function RepurchaseDialog({
  seed,
  title = "Buy again",
  onClose,
  onPurchased,
}: {
  seed: RepurchaseSeed;
  title?: string;
  onClose: () => void;
  onPurchased?: () => void;
}) {
  const { data: ref } = useRefData();
  const addStock = useAddStock();
  const showExpiry = seed.hasExpiry ?? true;

  const [quantity, setQuantity] = useState(seed.defaultQty ?? "1");
  const [unit, setUnit] = useState(seed.unit ?? "pcs");
  const [packSize, setPackSize] = useState(seed.packSize != null ? String(seed.packSize) : "");
  const [packSizeUnit, setPackSizeUnit] = useState(seed.packSizeUnit ?? "g");
  const [price, setPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState("");
  const [locationId, setLocationId] = useState(seed.locationId ?? "");
  const [storeName, setStoreName] = useState(seed.storeName ?? "");
  const [notes, setNotes] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    addStock.mutate(
      {
        itemId: seed.itemId ?? null,
        name: seed.name,
        brand: seed.brand ?? null,
        barcode: seed.barcode ?? null,
        domainId: seed.domainId ?? null,
        categoryId: seed.categoryId ?? null,
        attributes: seed.attributes ?? {},
        quantity: Number(quantity) || 1,
        unit,
        packSize: packSize ? Number(packSize) : null,
        packSizeUnit: packSize ? packSizeUnit : null,
        price: price ? Number(price) : null,
        currency: seed.currency,
        purchaseDate,
        expiryDate: showExpiry && expiryDate ? expiryDate : null,
        locationId: locationId || null,
        storeName: storeName.trim() || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Restocked ${seed.name}`);
          onPurchased?.();
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-text-muted">{seed.name}</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Quantity</label>
              <input className="input" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price ({seed.currency})</label>
              <input className="input" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="total" />
            </div>
            <div>
              <label className="label">Store</label>
              <input className="input" list="rp-stores" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              <datalist id="rp-stores">
                {ref?.stores.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <label className="label">Each unit contains (optional)</label>
            <div className="flex items-center gap-2">
              <input className="input w-24" type="number" min="0" step="any" value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="50" inputMode="decimal" />
              <select className="input w-24" value={packSizeUnit} onChange={(e) => setPackSizeUnit(e.target.value)}>
                {PACK_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted">
                {packSize && Number(packSize) > 0 ? `${quantity || 0} × ${packSize} ${packSizeUnit}` : "size per unit"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Purchased on</label>
              <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Expiry {showExpiry ? "" : "(n/a)"}</label>
              <input className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={!showExpiry} />
            </div>
            <div>
              <label className="label">Kept in</label>
              <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">—</option>
                {locationOptions(ref?.locations ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[56px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={addStock.isPending}>
              {addStock.isPending ? "Saving…" : "Add to stock"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
