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
import {
  cn,
  EXPIRY_STYLES,
  expiryBucket,
  expiryLabel,
  formatDate,
} from "@/lib/utils";
import { toast } from "sonner";

export function StockCard({ row, hidePlace = false }: { row: InventoryDetail; hidePlace?: boolean }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [buying, setBuying] = useState(false);
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
    <div className="card p-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mono flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] text-[11px] font-semibold uppercase tracking-wider",
            isActive ? "bg-surface-2 text-ink ring-1 ring-inset ring-border" : "bg-surface-2 text-text-muted",
          )}
          aria-hidden="true"
        >
          {row.item_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.item_image_url} alt="" className="h-10 w-10 rounded-[3px] object-cover" />
          ) : (
            row.item_name.slice(0, 2)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "line-clamp-2 break-words font-medium leading-snug",
              !isActive && "line-through text-text-muted",
            )}
          >
            {row.item_name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-text-muted">
            <span className="mono font-medium text-ink">
              {packLabel(row) ?? `${row.quantity}${row.unit ? ` ${row.unit}` : ""}`}
              {packTotal(row) && (
                <span className="ml-1 font-normal text-text-muted">({packTotal(row)})</span>
              )}
            </span>
            {row.item_brand && <span className="break-words">{row.item_brand}</span>}
            {attrs.map((a) => (
              <span key={a.label} className="break-words">
                {a.value}
              </span>
            ))}
            {!hidePlace && locationLabel && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="break-words">{locationLabel}</span>
              </span>
            )}
            {!isActive && row.finished_at && (
              <span>
                {row.status === "finished" ? "Used up" : row.status === "expired" ? "Expired" : "Thrown out"}{" "}
                <span className="mono">{formatDate(row.finished_at)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
            className="btn-ghost -mr-1 -mt-1 px-2 py-1.5"
            aria-label={`More actions for ${row.item_name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border bg-surface p-1 shadow-xl">
              <MenuItem icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
              {!isActive && (
                <MenuItem
                  icon={RotateCcw}
                  label="Back in stock"
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
              <MenuItem icon={Trash2} label="Delete" danger onClick={() => del.mutate(row.id)} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-[52px]">
          {row.expiry_date && isActive ? (
            <span className={cn("chip mono ring-inset", EXPIRY_STYLES[bucket])}>
              {expiryLabel(row.days_to_expiry)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {canUseOne && (
              <button
                onClick={useOne}
                disabled={consume.isPending}
                className="btn-outline px-2.5 py-1.5"
                title="Use one"
              >
                <Minus className="h-4 w-4" />
                Use 1
              </button>
            )}
            {isActive && (
              <button
                onClick={finish}
                disabled={setStatus.isPending}
                className="btn-outline px-2.5 py-1.5"
                title="Mark it used up"
              >
                <Check className="h-4 w-4" />
                {canUseOne ? "All done" : "Done"}
              </button>
            )}
            {!isActive && (
              <button
                onClick={() => setBuying(true)}
                className="btn-outline px-2.5 py-1.5"
                title="Buy this again — adds a fresh entry to your stock"
              >
                <ShoppingCart className="h-4 w-4" />
                Buy again
              </button>
            )}
          </div>
        </div>
    </div>
    {editing && <EditStockDialog row={row} onClose={() => setEditing(false)} />}
    {buying && (
      <RepurchaseDialog seed={seedFromLot(row)} onClose={() => setBuying(false)} />
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
        "flex w-full items-center gap-2 rounded-[3px] px-3 py-2 text-sm hover:bg-surface-2",
        danger && "text-bad",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
