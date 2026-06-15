"use client";

import { Search, Check, X, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStockSearch } from "@/lib/queries";
import { expiryBucket, EXPIRY_STYLES, expiryLabel, cn } from "@/lib/utils";

// The headline feature: type a grocery name and instantly see whether you
// already have it somewhere in the house — before you buy it again.
export function CheckHaveSearch() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: results = [], isFetching } = useStockSearch(debounced);
  const showPanel = open && debounced.trim().length >= 1;
  const totalQty = results.reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <div ref={boxRef} className="relative max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Do I have…?  Search your home — rice, shampoo, batteries…"
          className="input pl-10 pr-9"
        />
        {term && (
          <button
            onClick={() => {
              setTerm("");
              setDebounced("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted hover:bg-surface-2"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-12 z-40 max-h-[60vh] overflow-auto rounded-2xl border bg-surface p-2 shadow-xl">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm font-medium">No — you don't have that.</p>
              <p className="mt-1 text-xs text-text-muted">
                Nothing matching “{debounced}” is in stock. Add it to your list.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-brand-600">
                <Check className="h-4 w-4" />
                Yes — {results.length} match{results.length > 1 ? "es" : ""} ·{" "}
                {totalQty} total in stock
              </div>
              <ul className="space-y-1">
                {results.map((r) => {
                  const bucket = expiryBucket(r.days_to_expiry);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-surface-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.item_name}
                          {r.item_brand && (
                            <span className="text-text-muted"> · {r.item_brand}</span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-text-muted">
                          <MapPin className="h-3 w-3" />
                          {r.location_name ?? "Unfiled"} · {r.quantity}
                          {r.unit ? ` ${r.unit}` : ""}
                        </p>
                      </div>
                      {r.expiry_date && (
                        <span className={cn("chip shrink-0", EXPIRY_STYLES[bucket])}>
                          {expiryLabel(r.days_to_expiry)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
