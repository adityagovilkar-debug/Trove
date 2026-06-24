"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, Package } from "lucide-react";
import { searchProducts, type BarcodeProduct } from "@/lib/barcode";

// Free-text product lookup that auto-fills the add form — the fallback for when
// a barcode won't scan. Debounced search against Open Food Facts; pick a result
// to populate name / brand / image / barcode.
export function ProductSearch({ onPick }: { onPick: (p: BarcodeProduct) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BarcodeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchProducts(term);
      setResults(r);
      setLoading(false);
      setOpen(true);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  function pick(p: BarcodeProduct) {
    onPick(p);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  const showEmpty = open && !loading && q.trim().length >= 2 && results.length === 0;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
      <input
        className="input pl-10"
        placeholder="Search a product to auto-fill…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-surface p-1 shadow-xl">
          {results.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={() => pick(p)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-2"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                    <Package className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-text-muted">
                    {[p.brand, p.quantity].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border bg-surface p-3 text-xs text-text-muted shadow-xl">
          No matches — just type the name in below.
        </div>
      )}
    </div>
  );
}
