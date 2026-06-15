"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAddStock, useRefData } from "@/lib/queries";
import { lookupBarcode, lookupBook } from "@/lib/barcode";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { AttributeFields } from "@/components/AttributeFields";

const UNITS = ["pcs", "pack", "g", "kg", "ml", "L", "bottle", "can", "box", "dozen"];
const today = () => new Date().toISOString().slice(0, 10);

export default function AddPage() {
  const router = useRouter();
  const { data: ref } = useRefData();
  const addStock = useAddStock();

  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // form state
  const [domainId, setDomainId] = useState<string>("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [notes, setNotes] = useState("");
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});

  const currency = ref?.household.base_currency ?? "INR";
  const selectedDomain = ref?.domains.find((d) => d.id === domainId);
  const showExpiry = selectedDomain?.has_expiry ?? true;
  const categories = useMemo(
    () =>
      (ref?.categories ?? []).filter(
        (c) => !domainId || !c.domain_id || c.domain_id === domainId,
      ),
    [ref?.categories, domainId],
  );

  async function handleScanned(code: string) {
    setScanning(false);
    setBarcode(code);
    setLookingUp(true);
    // Books carry ISBNs — look them up in Open Library instead of food data.
    if (selectedDomain?.key === "book") {
      const book = await lookupBook(code);
      setLookingUp(false);
      setAttributes((a) => ({
        ...a,
        isbn: code,
        author: book?.author ?? (a.author as string) ?? "",
      }));
      if (book) {
        setName(book.title);
        toast.success(`Found: ${book.title}`);
      } else {
        toast.message("ISBN saved — fill in the title.");
      }
      return;
    }
    const product = await lookupBarcode(code);
    setLookingUp(false);
    if (product) {
      setName(product.name);
      if (product.brand) setBrand(product.brand);
      if (product.imageUrl) setImageUrl(product.imageUrl);
      toast.success(`Found: ${product.name}`);
    } else {
      toast.message("Barcode saved — couldn't auto-find it, fill in the name.");
    }
  }

  function reset() {
    setName(""); setBrand(""); setBarcode(""); setImageUrl(null);
    setCategoryId(""); setQuantity("1"); setUnit("pcs"); setPrice("");
    setExpiryDate(""); setStoreName(""); setNotes(""); setAttributes({});
    setPurchaseDate(today());
  }

  function onSubmit(e: React.FormEvent, addAnother = false) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the item a name");
    addStock.mutate(
      {
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode || null,
        imageUrl,
        domainId: domainId || null,
        categoryId: categoryId || null,
        quantity: Number(quantity) || 1,
        unit,
        price: price ? Number(price) : null,
        currency,
        purchaseDate,
        expiryDate: showExpiry && expiryDate ? expiryDate : null,
        locationId: locationId || null,
        storeName: storeName.trim() || null,
        notes: notes.trim() || null,
        attributes,
      },
      {
        onSuccess: () => {
          toast.success(`Added “${name.trim()}”`);
          if (addAnother) reset();
          else router.push("/inventory");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to add"),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {scanning && (
        <BarcodeScanner onDetect={handleScanned} onClose={() => setScanning(false)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Add stock</h1>
        <p className="text-sm text-text-muted">
          Scan a barcode to auto-fill, or type it in.
        </p>
      </div>

      <form onSubmit={(e) => onSubmit(e, false)} className="space-y-5">
        {/* Domain selector */}
        <div className="card p-4">
          <label className="label">Type of thing</label>
          <div className="flex flex-wrap gap-2">
            {ref?.domains.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => {
                  setDomainId(d.id);
                  setAttributes({});
                }}
                className={`chip ring-border ${
                  domainId === d.id
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        {/* Identity */}
        <div className="card space-y-4 p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">Item name *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basmati Rice"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="btn-outline shrink-0"
              title="Scan barcode"
            >
              {lookingUp ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <ScanLine className="h-[18px] w-[18px]" />
              )}
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Brand</label>
              <input
                className="input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              auto-filled from barcode
            </div>
          )}
        </div>

        {/* Domain-specific details (electronics, books, …) */}
        <AttributeFields
          domainKey={selectedDomain?.key}
          values={attributes}
          onChange={setAttributes}
        />

        {/* Quantity & money */}
        <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div>
            <label className="label">Quantity</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
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
            <label className="label">Price ({currency})</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="total"
            />
          </div>
          <div>
            <label className="label">Store</label>
            <input
              className="input"
              list="stores"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="where bought"
            />
            <datalist id="stores">
              {ref?.stores.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Dates & location */}
        <div className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div>
            <label className="label">Purchased on</label>
            <input
              className="input"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              Expiry {showExpiry ? "" : "(n/a for this type)"}
            </label>
            <input
              className="input"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={!showExpiry}
            />
          </div>
          <div>
            <label className="label">Kept in</label>
            <select
              className="input"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">—</option>
              {ref?.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-4">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[72px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="anything else worth remembering"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={addStock.isPending}>
            {addStock.isPending ? "Saving…" : "Save & view inventory"}
          </button>
          <button
            type="button"
            onClick={(e) => onSubmit(e, true)}
            className="btn-outline"
            disabled={addStock.isPending}
          >
            Save & add another
          </button>
        </div>
      </form>
    </div>
  );
}
