"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Minus,
  Plus,
  MapPin,
  Pencil,
  Check,
  Trash2,
  ArrowUpDown,
  Store as StoreIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { InventoryDetail } from "@/lib/types";
import {
  groupIntoProducts,
  lotToConsume,
  type ProductGroup,
} from "@/lib/products";
import {
  useConsume,
  useDeleteStock,
  useSetStatus,
  useLocationPaths,
} from "@/lib/queries";
import {
  cn,
  EXPIRY_STYLES,
  expiryBucket,
  expiryLabel,
  formatDate,
  formatMoney,
} from "@/lib/utils";
import { EditStockDialog } from "./EditStockDialog";
import { AddPurchaseDialog } from "./AddPurchaseDialog";
import { SwipeRow } from "./SwipeRow";

type SortKey = "name" | "totalQty" | "nearestExpiryDays" | "totalValue" | "lastPurchase";

// Distinct full-path location labels across a product's lots.
function groupLocations(lots: InventoryDetail[], locPaths: Map<string, string>) {
  const set = new Set<string>();
  for (const l of lots) {
    const label = (l.location_id && locPaths.get(l.location_id)) || l.location_name;
    if (label) set.add(label);
  }
  return [...set];
}

export function InventoryTable({ rows }: { rows: InventoryDetail[] }) {
  const products = useMemo(() => groupIntoProducts(rows), [rows]);
  const consume = useConsume();
  const locPaths = useLocationPaths();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "nearestExpiryDays",
    dir: 1,
  });
  const [editLot, setEditLot] = useState<InventoryDetail | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<ProductGroup | null>(null);

  const sorted = useMemo(() => {
    const arr = [...products];
    arr.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";
      switch (sort.key) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "nearestExpiryDays":
          av = a.nearestExpiryDays ?? Infinity;
          bv = b.nearestExpiryDays ?? Infinity;
          break;
        default:
          av = a[sort.key] as number;
          bv = b[sort.key] as number;
      }
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return arr;
  }, [products, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  }
  function toggle(key: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function useOne(g: ProductGroup) {
    const lot = lotToConsume(g);
    if (!lot) return;
    consume.mutate(
      { id: lot.id, quantity: Number(lot.quantity) },
      {
        onSuccess: (res) =>
          toast.success(
            res.finished && g.lotCount === 1
              ? `Finished the last ${g.name}`
              : `Used 1 ${g.name} · ${g.totalQty - 1} left`,
          ),
      },
    );
  }

  return (
    <>
      {editLot && <EditStockDialog row={editLot} onClose={() => setEditLot(null)} />}
      {purchaseFor && (
        <AddPurchaseDialog product={purchaseFor} onClose={() => setPurchaseFor(null)} />
      )}

      {/* Mobile: swipeable product cards (swipe → Use 1 / Buy again) */}
      <div className="space-y-2 md:hidden">
        {sorted.map((g) => (
          <ProductCardMobile
            key={g.key}
            product={g}
            onUseOne={() => useOne(g)}
            onBuyAgain={() => setPurchaseFor(g)}
            onEditLot={setEditLot}
          />
        ))}
      </div>

      {/* Desktop: full table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="w-8 px-2 py-3" />
              <Th label="Product" onClick={() => toggleSort("name")} active={sort.key === "name"} />
              <Th label="In stock" onClick={() => toggleSort("totalQty")} active={sort.key === "totalQty"} />
              <th className="px-4 py-3 font-medium">Where</th>
              <Th label="Expiry" onClick={() => toggleSort("nearestExpiryDays")} active={sort.key === "nearestExpiryDays"} />
              <Th label="Value" onClick={() => toggleSort("totalValue")} active={sort.key === "totalValue"} />
              <Th label="Last bought" onClick={() => toggleSort("lastPurchase")} active={sort.key === "lastPurchase"} />
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => {
              const isOpen = expanded.has(g.key);
              const bucket = expiryBucket(g.nearestExpiryDays);
              return (
                <FragmentRows key={g.key}>
                  <tr className="border-b hover:bg-surface-2/50">
                    <td className="px-2 py-3">
                      {g.lotCount > 1 ? (
                        <button onClick={() => toggle(g.key)} className="rounded p-1 hover:bg-surface-2" aria-label="Expand">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{g.name}</span>
                        {g.domainName && (
                          <span className="chip bg-surface-2 text-text-muted ring-border ring-inset">
                            {g.domainName}
                          </span>
                        )}
                      </div>
                      {g.brand && <div className="text-xs text-text-muted">{g.brand}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {g.totalQty}
                        {g.unit ? ` ${g.unit}` : ""}
                      </span>
                      {g.lotCount > 1 && (
                        <span className="ml-1 text-xs text-text-muted">({g.lotCount} lots)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {groupLocations(g.lots, locPaths).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {g.nearestExpiryDays != null ? (
                        <span className={cn("chip ring-inset", EXPIRY_STYLES[bucket])}>
                          {expiryLabel(g.nearestExpiryDays)}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatMoney(g.totalValue, g.currency)}</td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(g.lastPurchase)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => useOne(g)} disabled={consume.isPending} className="btn-outline px-2.5 py-1.5" title="Use one (oldest/soonest-to-expire first)">
                          <Minus className="h-4 w-4" />
                          <span className="hidden sm:inline">Use 1</span>
                        </button>
                        <button onClick={() => setPurchaseFor(g)} className="btn-ghost px-2 py-1.5" title="Add another purchase">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isOpen &&
                    g.lots.map((lot) => (
                      <LotRow
                        key={lot.id}
                        lot={lot}
                        onEdit={() => setEditLot(lot)}
                      />
                    ))}
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-text", active && "text-text")}>
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

// Expanded purchase-lot row.
function LotRow({ lot, onEdit }: { lot: InventoryDetail; onEdit: () => void }) {
  const consume = useConsume();
  const setStatus = useSetStatus();
  const del = useDeleteStock();
  const locPaths = useLocationPaths();
  const bucket = expiryBucket(lot.days_to_expiry);
  const locationLabel =
    (lot.location_id && locPaths.get(lot.location_id)) || lot.location_name || "—";
  return (
    <tr className="border-b bg-surface-2/30 text-xs">
      <td />
      <td className="px-4 py-2 text-text-muted">
        <span className="inline-flex items-center gap-1">
          <StoreIcon className="h-3 w-3" />
          {lot.store_name ?? "purchase"} · {formatDate(lot.purchase_date)}
        </span>
      </td>
      <td className="px-4 py-2">
        {lot.quantity}
        {lot.unit ? ` ${lot.unit}` : ""}
      </td>
      <td className="px-4 py-2 text-text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {locationLabel}
        </span>
      </td>
      <td className="px-4 py-2">
        {lot.expiry_date ? (
          <span className={cn("chip ring-inset", EXPIRY_STYLES[bucket])}>
            {expiryLabel(lot.days_to_expiry)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2 text-text-muted">{formatMoney(lot.price, lot.currency)}</td>
      <td />
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => consume.mutate({ id: lot.id, quantity: Number(lot.quantity) })}
            className="rounded-lg p-1.5 hover:bg-surface-2"
            title="Use one from this lot"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onEdit} className="rounded-lg p-1.5 hover:bg-surface-2" title="Edit this purchase">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setStatus.mutate({ id: lot.id, status: "finished" })}
            className="rounded-lg p-1.5 hover:bg-surface-2"
            title="Finish this lot"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => del.mutate(lot.id)}
            className="rounded-lg p-1.5 text-rose-500 hover:bg-surface-2"
            title="Delete this purchase"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Helper to render multiple sibling <tr> without a wrapper element.
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Mobile product card: swipe right = Use 1, swipe left = Buy again. Tap to
// expand the individual purchase lots.
function ProductCardMobile({
  product: g,
  onUseOne,
  onBuyAgain,
  onEditLot,
}: {
  product: ProductGroup;
  onUseOne: () => void;
  onBuyAgain: () => void;
  onEditLot: (lot: InventoryDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const locPaths = useLocationPaths();
  const locs = groupLocations(g.lots, locPaths);
  const bucket = expiryBucket(g.nearestExpiryDays);
  const multi = g.lotCount > 1;
  return (
    <SwipeRow
      left={{ label: "Use 1", icon: <Minus className="h-4 w-4" />, bg: "bg-brand-600 text-white", onAction: onUseOne }}
      right={{ label: "Buy again", icon: <Plus className="h-4 w-4" />, bg: "bg-sky-600 text-white", onAction: onBuyAgain }}
    >
      <div className="card p-3">
        <button
          onClick={() => multi && setOpen((o) => !o)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{g.name}</span>
              {g.domainName && (
                <span className="chip bg-surface-2 text-text-muted ring-border ring-inset">
                  {g.domainName}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
              <span className="font-medium text-text">
                {g.totalQty}
                {g.unit ? ` ${g.unit}` : ""}
              </span>
              {multi && <span>{g.lotCount} lots</span>}
              {locs.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {locs.join(", ")}
                </span>
              )}
              {g.totalValue > 0 && <span>{formatMoney(g.totalValue, g.currency)}</span>}
            </div>
          </div>
          {g.nearestExpiryDays != null && (
            <span className={cn("chip shrink-0 ring-inset", EXPIRY_STYLES[bucket])}>
              {expiryLabel(g.nearestExpiryDays)}
            </span>
          )}
          {multi &&
            (open ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
            ))}
        </button>

        {open && (
          <div className="mt-2 space-y-2 border-t pt-2">
            {g.lots.map((lot) => (
              <MobileLotRow key={lot.id} lot={lot} onEdit={() => onEditLot(lot)} />
            ))}
          </div>
        )}
      </div>
    </SwipeRow>
  );
}

function MobileLotRow({ lot, onEdit }: { lot: InventoryDetail; onEdit: () => void }) {
  const consume = useConsume();
  const setStatus = useSetStatus();
  const del = useDeleteStock();
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="text-text">
          {lot.quantity}
          {lot.unit ? ` ${lot.unit}` : ""} · {formatMoney(lot.price, lot.currency)}
        </div>
        <div className="truncate text-text-muted">
          {formatDate(lot.purchase_date)}
          {lot.store_name ? ` · ${lot.store_name}` : ""}
          {lot.expiry_date ? ` · ${expiryLabel(lot.days_to_expiry)}` : ""}
        </div>
      </div>
      <button onClick={() => consume.mutate({ id: lot.id, quantity: Number(lot.quantity) })} className="rounded-lg p-1.5 hover:bg-surface-2" title="Use one">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button onClick={onEdit} className="rounded-lg p-1.5 hover:bg-surface-2" title="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setStatus.mutate({ id: lot.id, status: "finished" })} className="rounded-lg p-1.5 hover:bg-surface-2" title="Finish">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => del.mutate(lot.id)} className="rounded-lg p-1.5 text-rose-500 hover:bg-surface-2" title="Delete">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
