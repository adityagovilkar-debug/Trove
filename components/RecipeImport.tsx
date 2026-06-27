"use client";

import { useEffect, useState } from "react";
import { X, Search, Loader2, Globe } from "lucide-react";
import { searchRecipes, type OnlineRecipe } from "@/lib/recipeSearch";

// Search an open recipe database (TheMealDB) and pick a dish to import. The
// picked recipe's ingredients / quantities / method seed the recipe editor.
export function RecipeImport({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (r: OnlineRecipe) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<OnlineRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchRecipes(term);
      setResults(r);
      setLoading(false);
      setSearched(true);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Globe className="h-4 w-4 text-brand-500" />
            Find a recipe online
          </p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
            <input
              className="input pl-10"
              autoFocus
              placeholder="Search a dish, e.g. paneer, biryani, curry…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-surface-2"
            >
              {r.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                  <Globe className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{r.name}</p>
                  {r.source === "local" && (
                    <span className="chip shrink-0 bg-brand-100 text-brand-700 ring-brand-500/30 ring-inset dark:bg-brand-900/40 dark:text-brand-300">
                      regional
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-text-muted">
                  {[r.area, r.category].filter(Boolean).join(" · ")}
                  {r.ingredients.length > 0 && ` · ${r.ingredients.length} ingredients`}
                </p>
              </div>
            </button>
          ))}

          {searched && !loading && results.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              No recipes found. Try a different name.
            </p>
          )}
          {!searched && !loading && (
            <p className="py-8 text-center text-xs text-text-muted">
              Search by dish name — regional Indian home dishes plus TheMealDB.
              You can tweak everything before saving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
