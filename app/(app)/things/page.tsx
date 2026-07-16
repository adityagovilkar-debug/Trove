"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Search, MapPin, PackageOpen, List, Map as MapIcon } from "lucide-react";
import { useInventory, useRefData, useLocationPaths } from "@/lib/queries";
import { StockCard } from "@/components/StockCard";
import { InventoryTable } from "@/components/InventoryTable";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { rowSpace, domainSpace } from "@/lib/space";
import { cn } from "@/lib/utils";
import type { InventoryDetail } from "@/lib/types";

type ViewMode = "location" | "list";

// The Home space's inventory: durables, browsed the way you actually look for
// them — by where they live. "By location" is a virtual tour of the house;
// "List" is the product-grouped table for scanning and bulk actions.
function ThingsInner() {
  const params = useSearchParams();
  const [domainId, setDomainId] = useState<string | null>(params.get("domain"));
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("location");

  const { data: ref } = useRefData();
  const { data: rows = [], isLoading } = useInventory({ status: "active" });
  const locPaths = useLocationPaths();

  const homeDomains = useMemo(
    () => (ref?.domains ?? []).filter((d) => domainSpace(d) === "home"),
    [ref?.domains],
  );

  const visible = useMemo(() => {
    let r = rows.filter((x) => rowSpace(x) === "home");
    if (domainId) r = r.filter((x) => x.domain_id === domainId);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (x) =>
          x.item_name.toLowerCase().includes(q) ||
          (x.item_brand ?? "").toLowerCase().includes(q),
      );
    return r;
  }, [rows, domainId, search]);

  // Group by full location path — the "open each drawer" view. Unfiled last.
  const byLocation = useMemo(() => {
    const groups = new Map<string, InventoryDetail[]>();
    for (const r of visible) {
      const label =
        (r.location_id && locPaths.get(r.location_id)) || r.location_name || "";
      const key = label || "· Unfiled";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible, locPaths]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Things</h1>
          <p className="text-sm text-text-muted">
            Everything around the house, and exactly where it lives.
          </p>
        </div>
        <Link href="/add" className="btn-primary">
          <PlusCircle className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add</span>
        </Link>
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or brand…"
            className="input pl-10"
          />
        </div>
        <div className="flex rounded-xl bg-surface-2 p-1">
          {(
            [
              { key: "location", label: "By location", icon: MapIcon },
              { key: "list", label: "List", icon: List },
            ] as { key: ViewMode; label: string; icon: typeof MapIcon }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === key ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Domain filter */}
      {homeDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={domainId === null} onClick={() => setDomainId(null)}>
            All types
          </FilterChip>
          {homeDomains.map((d) => (
            <FilterChip key={d.id} active={domainId === d.id} onClick={() => setDomainId(d.id)}>
              {d.name}
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <SkeletonRows n={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nothing here"
          hint="Add electronics, luggage, tools, plants — anything around the house — and browse it by where it's kept."
        />
      ) : view === "list" ? (
        <InventoryTable rows={visible} />
      ) : (
        <div className="space-y-5">
          {byLocation.map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {label === "· Unfiled" ? "Unfiled — no location yet" : label}
                <span className="font-normal normal-case">· {items.length}</span>
              </h2>
              <div className="space-y-2">
                {items.map((r) => (
                  <StockCard key={r.id} row={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "chip ring-border transition-colors",
        active ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export default function ThingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading…</div>}>
      <ThingsInner />
    </Suspense>
  );
}
