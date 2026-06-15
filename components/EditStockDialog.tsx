"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { InventoryDetail } from "@/lib/types";
import { useRefData, useUpdateStock } from "@/lib/queries";
import { AttributeFields } from "./AttributeFields";

const UNITS = ["pcs", "pack", "g", "kg", "ml", "L", "bottle", "can", "box", "dozen"];

export function EditStockDialog({
  row,
  onClose,
}: {
  row: InventoryDetail;
  onClose: () => void;
}) {
  const { data: ref } = useRefData();
  const update = useUpdateStock();

  const [name, setName] = useState(row.item_name);
  const [brand, setBrand] = useState(row.item_brand ?? "");
  const [categoryId, setCategoryId] = useState(row.category_id ?? "");
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [unit, setUnit] = useState(row.unit ?? "pcs");
  const [price, setPrice] = useState(row.price != null ? String(row.price) : "");
  const [purchaseDate, setPurchaseDate] = useState(row.purchase_date);
  const [expiryDate, setExpiryDate] = useState(row.expiry_date ?? "");
  const [locationId, setLocationId] = useState(row.location_id ?? "");
  const [storeName, setStoreName] = useState(row.store_name ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    row.item_attributes ?? {},
  );

  const showExpiry = row.domain_has_expiry ?? true;
  const categories = useMemo(
    () =>
      (ref?.categories ?? []).filter(
        (c) => !row.domain_id || !c.domain_id || c.domain_id === row.domain_id,
      ),
    [ref?.categories, row.domain_id],
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the item a name");
    update.mutate(
      {
        id: row.id,
        itemId: row.item_id,
        name: name.trim(),
        brand: brand.trim() || null,
        categoryId: categoryId || null,
        attributes,
        quantity: Number(quantity) || 0,
        unit,
        price: price ? Number(price) : null,
        purchaseDate,
        expiryDate: showExpiry && expiryDate ? expiryDate : null,
        locationId: locationId || null,
        storeName: storeName.trim() || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Saved changes");
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't save"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="font-semibold">Edit entry</p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 overflow-y-auto p-4">
          <div className="card space-y-4 p-4">
            <div>
              <label className="label">Item name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Brand</label>
                <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <AttributeFields
            domainKey={row.domain_key}
            values={attributes}
            onChange={setAttributes}
          />

          <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <div>
              <label className="label">Quantity</label>
              <input className="input" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price ({row.currency})</label>
              <input className="input" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="label">Store</label>
              <input className="input" list="edit-stores" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              <datalist id="edit-stores">
                {ref?.stores.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
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

          <div className="card p-4">
            <label className="label">Notes</label>
            <textarea className="input min-h-[64px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
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
