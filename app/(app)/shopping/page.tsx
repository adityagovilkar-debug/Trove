"use client";

import { useMemo, useState } from "react";
import { Plus, Check, Trash2, ShoppingCart, Sparkles, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  useShoppingList,
  useAddShoppingItems,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearBought,
  useRefData,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { RepurchaseDialog, seedFromShopping } from "@/components/RepurchaseDialog";
import type { ShoppingItem } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  restock: "predicted",
  finished: "ran out",
  recipe: "for a recipe",
  manual: "",
};

export default function ShoppingPage() {
  const { data: items = [], isLoading } = useShoppingList();
  const { data: ref } = useRefData();
  const add = useAddShoppingItems();
  const toggle = useToggleShoppingItem();
  const del = useDeleteShoppingItem();
  const clear = useClearBought();
  const [name, setName] = useState("");
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const currency = ref?.household.base_currency ?? "INR";

  const { pending, bought } = useMemo(
    () => ({
      pending: items.filter((i) => !i.is_bought),
      bought: items.filter((i) => i.is_bought),
    }),
    [items],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    add.mutate([{ name: n, source: "manual" }], {
      onSuccess: () => setName(""),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add"),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-sm text-text-muted">
          What to buy next time you're out. Check things off as you shop.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item…"
        />
        <button className="btn-primary shrink-0" disabled={add.isPending}>
          <Plus className="h-[18px] w-[18px]" />
        </button>
      </form>

      {isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Your list is empty"
          hint="Add items above, or pull in suggestions from the dashboard's “Running low”. Finished groceries land here automatically."
        />
      ) : (
        <>
          <div className="card divide-y">
            {pending.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-muted">
                Nothing left to buy — nice. 🎉
              </p>
            ) : (
              pending.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => toggle.mutate({ id: it.id, is_bought: true })}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border hover:border-brand-500"
                    aria-label="Mark bought"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {it.name}
                      {it.quantity ? (
                        <span className="text-text-muted">
                          {" "}
                          · {it.quantity}
                          {it.unit ? ` ${it.unit}` : ""}
                        </span>
                      ) : null}
                    </p>
                    {SOURCE_LABEL[it.source] && (
                      <p className="flex items-center gap-1 text-xs text-text-muted">
                        <Sparkles className="h-3 w-3" />
                        {SOURCE_LABEL[it.source]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setBuying(it)}
                    className="btn-outline shrink-0 px-2.5 py-1.5"
                    title="Bought it — add to stock"
                  >
                    <PackagePlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Buy</span>
                  </button>
                  <button
                    onClick={() => del.mutate(it.id)}
                    className="btn-ghost px-2 py-1.5 text-text-muted hover:text-rose-500"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {bought.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  In the cart · {bought.length}
                </p>
                <button
                  onClick={() => clear.mutate()}
                  className="text-xs text-text-muted hover:text-rose-500"
                >
                  Clear
                </button>
              </div>
              <div className="card divide-y opacity-70">
                {bought.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggle.mutate({ id: it.id, is_bought: false })}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"
                      aria-label="Mark not bought"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <p className="flex-1 truncate text-sm line-through">{it.name}</p>
                    <button
                      onClick={() => del.mutate(it.id)}
                      className="btn-ghost px-2 py-1.5 text-text-muted hover:text-rose-500"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
        <ShoppingCart className="h-3.5 w-3.5" />
        Shared with your household in real time
      </p>

      {buying && (
        <RepurchaseDialog
          seed={seedFromShopping(buying, currency)}
          title="Add to stock"
          onClose={() => setBuying(null)}
          onPurchased={() => toggle.mutate({ id: buying.id, is_bought: true })}
        />
      )}
    </div>
  );
}
