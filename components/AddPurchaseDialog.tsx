"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAddStock, useRefData } from "@/lib/queries";
import type { ProductGroup } from "@/lib/products";

const UNITS = ["pcs", "pack", "g", "kg", "ml", "L", "bottle", "can", "box", "dozen"];
const today = () => new Date().toISOString().slice(0, 10);

// Records another purchase (lot) of an existing product. Because useAddStock
// de-dupes by name+domain, the new lot attaches to the same product — so the
// product's total quantity goes up while each purchase keeps its own price/date.
export function AddPurchaseDialog({
  product,
  onClose,
}: {
  product: ProductGroup;
  onClose: () => void;
}) {
  const { data: ref } = useRefData();
  const addStock = useAddStock();
  const rep = product.lots[0];
  const showExpiry = rep?.domain_has_expiry ?? true;

  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(product.unit ?? "pcs");
  const [price, setPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState("");
  const [locationId, setLocationId] = useState(rep?.location_id ?? "");
  const [storeName, setStoreName] = useState(rep?.store_name ?? "");
  const [notes, setNotes] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    addStock.mutate(
      {
        name: product.name,
        brand: product.brand,
        barcode: rep?.item_barcode ?? null,
        domainId: product.domainId,
        categoryId: rep?.category_id ?? null,
        attributes: product.attributes,
        quantity: Number(quantity) || 1,
        unit,
        price: price ? Number(price) : null,
        currency: product.currency,
        purchaseDate,
        expiryDate: showExpiry && expiryDate ? expiryDate : null,
        locationId: locationId || null,
        storeName: storeName.trim() || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Added ${quantity} more ${product.name}`);
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't add"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <div>
            <p className="font-semibold">New purchase</p>
            <p className="text-xs text-text-muted">{product.name}</p>
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
              <label className="label">Price ({product.currency})</label>
              <input className="input" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="total" />
            </div>
            <div>
              <label className="label">Store</label>
              <input className="input" list="ap-stores" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              <datalist id="ap-stores">
                {ref?.stores.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
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
                {ref?.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
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
              {addStock.isPending ? "Saving…" : "Add purchase"}
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
