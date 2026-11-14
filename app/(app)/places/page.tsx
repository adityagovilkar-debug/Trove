"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Settings2, X } from "lucide-react";
import { useInventory, useRefData } from "@/lib/queries";
import { LocationManager } from "@/components/LocationManager";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { ScreenHead, Section, Led } from "@/components/instrument";
import { expiryBucket, cn } from "@/lib/utils";
import type { InventoryDetail, Location } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";

// The house as a tree. Every place shows how many things are in it (counting
// everything inside it); opening one shows what sits there directly.
export default function PlacesPage() {
  const { data: ref, isLoading: lr } = useRefData();
  const { data: active = [], isLoading: la } = useInventory({ status: "active" });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [managing, setManaging] = useState(false);
  const hydrated = useHydrated();

  const locations = useMemo(() => ref?.locations ?? [], [ref?.locations]);

  const { roots, kids, direct, total, unfiled } = useMemo(() => {
    const kids = new Map<string, Location[]>();
    const roots: Location[] = [];
    const ids = new Set(locations.map((l) => l.id));
    for (const l of locations) {
      if (l.parent_id && ids.has(l.parent_id)) {
        if (!kids.has(l.parent_id)) kids.set(l.parent_id, []);
        kids.get(l.parent_id)!.push(l);
      } else roots.push(l);
    }
    const byName = (a: Location, b: Location) => a.name.localeCompare(b.name);
    roots.sort(byName);
    for (const list of kids.values()) list.sort(byName);

    const direct = new Map<string, InventoryDetail[]>();
    const unfiled: InventoryDetail[] = [];
    for (const r of active) {
      if (r.location_id && ids.has(r.location_id)) {
        if (!direct.has(r.location_id)) direct.set(r.location_id, []);
        direct.get(r.location_id)!.push(r);
      } else unfiled.push(r);
    }
    const total = new Map<string, number>();
    const count = (id: string): number => {
      if (total.has(id)) return total.get(id)!;
      const n =
        (direct.get(id)?.length ?? 0) + (kids.get(id) ?? []).reduce((s, c) => s + count(c.id), 0);
      total.set(id, n);
      return n;
    };
    for (const l of locations) count(l.id);
    return { roots, kids, direct, total, unfiled };
  }, [locations, active]);

  const emptyCount = locations.filter((l) => (total.get(l.id) ?? 0) === 0 && !kids.has(l.id)).length;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(l: Location, depth: number): React.ReactNode {
    const isOpen = open.has(l.id);
    const children = kids.get(l.id) ?? [];
    const here = direct.get(l.id) ?? [];
    const n = total.get(l.id) ?? 0;
    const canOpen = children.length > 0 || here.length > 0;
    return (
      <div key={l.id}>
        <button
          onClick={() => canOpen && toggle(l.id)}
          className={cn(
            "flex w-full items-center gap-2 border-t border-dotted border-rule-strong py-2.5 pr-1 text-left",
            canOpen ? "hover:bg-surface-2" : "cursor-default",
          )}
          style={{ paddingLeft: 4 + depth * 18 }}
          aria-expanded={canOpen ? isOpen : undefined}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform",
              isOpen && "rotate-90",
              !canOpen && "opacity-0",
            )}
          />
          <span className={cn("min-w-0 flex-1 break-words text-sm", n === 0 ? "text-ink-3" : "font-medium")}>
            {l.name}
          </span>
          <span className={cn("mono shrink-0 text-xs", n === 0 ? "text-ink-4" : "text-ink-2")}>{n}</span>
        </button>
        {isOpen && (
          <>
            {here.length > 0 && <Contents items={here} indent={22 + depth * 18} />}
            {children.map((c) => renderNode(c, depth + 1))}
          </>
        )}
      </div>
    );
  }

  const isLoading = !hydrated || lr || la;

  return (
    <div className="pn2 mx-auto max-w-3xl space-y-4">
      <ScreenHead
        plate="PLACES"
        title="The house"
        sub="Open a place to see what is in it."
        actions={
          <button className="btn-outline" onClick={() => setManaging((m) => !m)}>
            {managing ? <X className="h-[18px] w-[18px]" /> : <Settings2 className="h-[18px] w-[18px]" />}
            <span className="hidden sm:inline">{managing ? "Done" : "Edit places"}</span>
          </button>
        }
      />

      {managing ? (
        <LocationManager />
      ) : isLoading ? (
        <SkeletonRows n={5} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          hint="Add the rooms, cupboards and boxes where you keep things."
        />
      ) : (
        <>
          {emptyCount > 0 && (
            <div className="card flex items-start gap-3 p-3.5 text-sm text-ink-2">
              <span className="mt-1.5">
                <Led tone="ink" />
              </span>
              <p className="min-w-0 flex-1">
                <b className="font-semibold text-ink">
                  {emptyCount} place{emptyCount > 1 ? "s" : ""} hold nothing right now.
                </b>{" "}
                Fill them as you add things, or tidy them away in{" "}
                <button onClick={() => setManaging(true)} className="font-medium text-ink underline">
                  Edit places
                </button>
                .
              </p>
            </div>
          )}

          <section className="space-y-2">
            <Section label="Rooms" right={<span className="meta">{roots.length}</span>} />
            <div className="card px-3 py-0 [&>div:first-child>button]:border-t-0">
              {roots.map((l) => renderNode(l, 0))}
            </div>
          </section>

          {unfiled.length > 0 && (
            <section className="space-y-2">
              <Section label="No place yet" right={<span className="meta">{unfiled.length}</span>} />
              <div className="card px-3 py-1">
                <Contents items={unfiled} indent={4} />
              </div>
            </section>
          )}

          <p className="text-center text-xs text-ink-3">
            Looking for something specific?{" "}
            <Link href="/" className="font-medium text-ink-2 hover:text-ink">
              Search from Home
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function Contents({ items, indent }: { items: InventoryDetail[]; indent: number }) {
  const sorted = [...items].sort((a, b) => a.item_name.localeCompare(b.item_name));
  return (
    <div
      className="mb-2 mr-1 rounded-[3px] border border-rule bg-surface-2 px-3 py-1.5"
      style={{ marginLeft: indent }}
    >
      {sorted.map((r) => {
        const b = expiryBucket(r.days_to_expiry);
        return (
          <div key={r.id} className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
            <span
              className={cn(
                "min-w-0 break-words",
                (b === "expired" || b === "critical") && "text-bad",
                b === "soon" && "text-watch",
              )}
            >
              {r.item_name}
            </span>
            <span className="mono shrink-0 text-[11px] text-ink-3">
              {Number(r.quantity)}
              {r.unit ? ` ${r.unit}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
