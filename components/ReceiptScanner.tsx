"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Receipt, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAddStock, useRefData } from "@/lib/queries";
import { parseReceiptText, type ReceiptItem } from "@/lib/receiptParse";
import { gemmaConfigured, parseReceiptWithGemma } from "@/lib/gemma";
import { locationOptions } from "@/lib/locations";

const today = () => new Date().toISOString().slice(0, 10);

interface Row extends ReceiptItem {
  key: string;
}

// Photograph a grocery receipt, OCR it on-device (Tesseract), structure it into
// line items (Gemma when available, else a heuristic parser), then review and
// bulk-add everything to stock in one go. Fully client-side.
export function ReceiptScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: ref } = useRefData();
  const addStock = useAddStock();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [smart, setSmart] = useState(false);

  const groceryDomain = useMemo(
    () => ref?.domains.find((d) => d.key === "grocery") ?? ref?.domains[0],
    [ref?.domains],
  );
  const [domainId, setDomainId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const currency = ref?.household.base_currency ?? "INR";

  const effectiveDomain = domainId || groceryDomain?.id || "";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      setStatus("Reading receipt…");
      const Tesseract = (await import("tesseract.js")).default;
      const {
        data: { text },
      } = await Tesseract.recognize(file, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text")
            setStatus(`Reading receipt… ${Math.round(m.progress * 100)}%`);
        },
      });
      if (!text.trim()) {
        toast.error("Couldn't read the receipt — try a flatter, brighter photo.");
        return;
      }

      let items: ReceiptItem[] | null = null;
      if (gemmaConfigured()) {
        setSmart(true);
        setStatus("Understanding items…");
        items = await parseReceiptWithGemma(text, setStatus);
      }
      if (!items || items.length === 0) items = parseReceiptText(text);

      if (!items.length) {
        toast.message("Read the receipt but couldn't pick out line items. Add them manually.");
        return;
      }
      setRows(items.map((it, i) => ({ ...it, key: `${Date.now()}-${i}` })));
    } catch {
      toast.error("Scan failed. You can still add items manually.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function patch(key: string, p: Partial<Row>) {
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...p } : r)) ?? rs);
  }
  function removeRow(key: string) {
    setRows((rs) => rs?.filter((r) => r.key !== key) ?? rs);
  }

  async function addAll() {
    const list = (rows ?? []).filter((r) => r.name.trim());
    if (!list.length) return;
    setBusy(true);
    let added = 0;
    for (const r of list) {
      try {
        await addStock.mutateAsync({
          name: r.name.trim(),
          domainId: effectiveDomain || null,
          quantity: r.quantity && r.quantity > 0 ? r.quantity : 1,
          unit: "pcs",
          price: r.price ?? null,
          currency,
          purchaseDate,
          locationId: locationId || null,
          storeName: storeName.trim() || null,
        });
        added++;
      } catch {
        // keep going; report the count at the end
      }
    }
    setBusy(false);
    if (added > 0) {
      toast.success(`Added ${added} item${added > 1 ? "s" : ""} to stock`);
      onClose();
      router.push("/inventory");
    } else {
      toast.error("Couldn't add the items. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Receipt className="h-4 w-4 text-brand-500" />
            Scan a receipt
          </p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

        {!rows ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-brand-500">
              <Receipt className="h-8 w-8" />
            </div>
            <p className="text-sm text-text-muted">
              Photograph a grocery receipt and Trove will pull out the items so you can add
              them all at once. Read on your device — nothing is uploaded.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              {busy ? status || "Scanning…" : "Take / choose photo"}
            </button>
            {gemmaConfigured() && (
              <span className="chip bg-brand-100 text-brand-700 ring-brand-500/20 ring-inset dark:bg-brand-900/30 dark:text-brand-300">
                <Sparkles className="h-3 w-3" /> Smart parsing · Gemma 4
              </span>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-1 gap-3 border-b p-4 sm:grid-cols-3">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={effectiveDomain}
                  onChange={(e) => setDomainId(e.target.value)}
                >
                  {ref?.domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Store</label>
                <input
                  className="input"
                  list="rs-stores"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="where bought"
                />
                <datalist id="rs-stores">
                  {ref?.stores.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">Purchased on</label>
                <input
                  className="input"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Kept in (optional)</label>
                <select
                  className="input"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">—</option>
                  {locationOptions(ref?.locations ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              <p className="text-xs text-text-muted">
                {rows.length} item{rows.length === 1 ? "" : "s"} found
                {smart ? " · parsed by Gemma 4" : ""}. Fix anything, remove what you don't want.
              </p>
              {rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={r.name}
                    onChange={(e) => patch(r.key, { name: e.target.value })}
                    placeholder="Item"
                  />
                  <input
                    className="input w-16"
                    type="number"
                    min="0"
                    step="any"
                    value={r.quantity ?? ""}
                    onChange={(e) =>
                      patch(r.key, { quantity: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="qty"
                  />
                  <input
                    className="input w-20"
                    type="number"
                    min="0"
                    step="any"
                    value={r.price ?? ""}
                    onChange={(e) =>
                      patch(r.key, { price: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder={currency}
                  />
                  <button
                    onClick={() => removeRow(r.key)}
                    className="btn-ghost shrink-0 px-2 py-1.5 text-text-muted hover:text-rose-500"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 border-t p-4">
              <button onClick={addAll} disabled={busy || rows.length === 0} className="btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add {rows.length} to stock
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="btn-outline"
              >
                Rescan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
