"use client";

import { useState } from "react";
import {
  Check,
  Minus,
  MoreVertical,
  Pencil,
  Trash2,
  CircleSlash,
  RotateCcw,
  MapPin,
  ShoppingCart,
  Store as StoreIcon,
} from "lucide-react";
import type { InventoryDetail } from "@/lib/types";
import {
  useConsume,
  useDeleteStock,
  useSetStatus,
  useLocationPaths,
} from "@/lib/queries";
import { prominentAttributes } from "@/lib/domainFields";
import { packLabel, packTotal } from "@/lib/products";
import { EditStockDialog } from "./EditStockDialog";
import { RepurchaseDialog, seedFromLot } from "./RepurchaseDialog";
import { ConsumeAmountDialog } from "./ConsumeAmountDialog";
import {
  cn,
  EXPIRY_STYLES,
  expiryBucket,
  expiryLabel,
  formatDate,
  formatMoney,
} from "@/lib/utils";
import { toast } from "sonner";

export function StockCard({ row }: { row: InventoryDetail }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [usingAmount, setUsingAmount] = useState(false);
  const setStatus = useSetStatus();
  const consume = useConsume();
  const del = useDeleteStock();
  const bucket = expiryBucket(row.days_to_expiry);
  const isActive = row.status === "active";
  const canUseOne = isActive && Number(row.quantity) > 1;
  const attrs = prominentAttributes(row.domain_key, row.item_attributes);
  const locPaths = useLocationPaths();
  const locationLabel =
    (row.location_id && locPaths.get(row.location_id)) || row.location_name;

  function finish() {
    setStatus.mutate(
      { id: row.id, status: "finished" },
      { onSuccess: () => toast.success(`Marked “${row.item_name}” as finished`) },
    );
    setMenu(false);
  }

  function useOne() {
    consume.mutate(
      { id: row.id, quantity: Number(row.quantity) },
      {
        onSuccess: (res) =>
          toast.success(
            res.finished
              ? `Finished the last of “${row.item_name}”`
              : `Used 1 — ${res.remaining}${row.unit ? " " + row.unit : ""} left`,
          ),
      },
    );
  }

  return (
    <>
    <div className="card flex items-center gap-3 p-3">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold uppercase",
          isActive ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-surface-2 text-text-muted",
        )}
      >
        {row.item_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.item_image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          row.item_name.slice(0, 2)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate font-medium", !isActive && "line-through text-text-muted")}>
            {row.item_name}
          </p>
          {row.domain_name && (
            <span className="chip bg-surface-2 text-text-muted ring-border">
              {row.domain_name}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          <span className="font-medium text-text">
            {packLabel(row) ?? `${row.quantity}${row.unit ? ` ${row.unit}` : ""}`}
            {packTotal(row) && (
              <span className="ml-1 font-normal text-text-muted">({packTotal(row)})</span>
            )}
          </span>
          {attrs.map((a) => (
            <span key={a.label}>{a.value}</span>
          ))}
          {locationLabel && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {locationLabel}
            </span>
          )}
          {row.store_name && (
            <span className="flex items-center gap-1">
              <StoreIcon className="h-3 w-3" />
              {row.store_name}
            </span>
          )}
          {row.price != null && <span>{formatMoney(row.price, row.currency)}</span>}
          <span>Bought {formatDate(row.purchase_date)}</span>
        </div>
      </div>

      {row.expiry_date && (
        <span className={cn("chip shrink-0", EXPIRY_STYLES[bucket])}>
          {expiryLabel(row.days_to_expiry)}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {canUseOne && (
          <button
            onClick={useOne}
            disabled={consume.isPending}
            className="btn-outline px-2.5 py-1.5"
            title="Use one (decrement quantity)"
          >
            <Minus className="h-4 w-4" />
            <span className="hidden sm:inline">Use 1</span>
          </button>
        )}
        {isActive && (
          <button
            onClick={finish}
            disabled={setStatus.isPending}
            className="btn-outline px-2.5 py-1.5"
            title="Mark the whole entry finished"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">{canUseOne ? "All done" : "Finished"}</span>
          </button>
        )}
        {!isActive && (
          <button
            onClick={() => setBuying(true)}
            className="btn-primary px-2.5 py-1.5"
            title="Buy this again — adds a fresh entry to your stock"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Buy again</span>
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
            className="btn-ghost px-2 py-1.5"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border bg-surface p-1 shadow-xl">
              <MenuItem icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
              {isActive && Number(row.quantity) > 0 && (
                <MenuItem icon={Minus} label="Use amount…" onClick={() => setUsingAmount(true)} />
              )}
              {!isActive && (
                <MenuItem
                  icon={RotateCcw}
                  label="Reactivate"
                  onClick={() => setStatus.mutate({ id: row.id, status: "active" })}
                />
              )}
              {isActive && (
                <MenuItem
                  icon={CircleSlash}
                  label="Mark expired"
                  onClick={() => setStatus.mutate({ id: row.id, status: "expired" })}
                />
              )}
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => del.mutate(row.id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
    {editing && <EditStockDialog row={row} onClose={() => setEditing(false)} />}
    {buying && (
      <RepurchaseDialog seed={seedFromLot(row)} onClose={() => setBuying(false)} />
    )}
    {usingAmount && (
      <ConsumeAmountDialog
        lot={{ id: row.id, name: row.item_name, quantity: Number(row.quantity), unit: row.unit }}
        onClose={() => setUsingAmount(false)}
      />
    )}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onMouseDown={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2",
        danger && "text-rose-600",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
