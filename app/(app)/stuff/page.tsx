"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Search, PackageOpen, MapPin } from "lucide-react";
import { useInventory, useLocationPaths } from "@/lib/queries";
import { StockCard } from "@/components/StockCard";
import { InventoryTable } from "@/components/InventoryTable";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { ScreenHead, Section } from "@/components/instrument";
import { KIND_LABEL, KIND_ORDER, isKind, kindOf, type Kind } from "@/lib/kinds";
import { cn } from "@/lib/utils";
import type { InventoryDetail } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";

type View = "place" | "list";
type Shelf = "stock" | "history";

// Everything in the house in one list (replaces Pantry + Things). Grouped by
// place by default, because that is how you go and look.
function StuffInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialKind = params.get("kind");
  const [kind, setKindState] = useState<Kind | null>(isKind(initialKind) ? initialKind : null);
  const [view, setView] = useState<View>("place");
  const [shelf, setShelf] = useState<Shelf>("stock");
  const [search, setSearch] = useState("");

  const { data: active = [], isLoading: la } = useInventory({ status: "active" });
  const { data: all = [], isLoading: lh } = useInventory({ status: "all" });
  const locPaths = useLocationPaths();
  const hydrated = useHydrated();

  function setKind(k: Kind | null) {
    setKindState(k);
    router.replace(k ? `/stuff?kind=${k}` : "/stuff", { scroll: false });
  }

  const pool = shelf === "stock" ? active : all.filter((r) => r.status !== "active");

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { food: 0, supplies: 0, things: 0, unsorted: 0 };
    for (const r of pool) c[kindOf(r.domain_key)]++;
    return c;
  }, [pool]);

  const visible = useMemo(() => {
    let r = pool;
    if (kind) r = r.filter((x) => kindOf(x.domain_key) === kind);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (x) =>
          x.item_name.toLowerCase().includes(q) ||
          (x.item_brand ?? "").toLowerCase().includes(q),
      );
    return r;
  }, [pool, kind, search]);

  const byPlace = useMemo(() => {
    const groups = new Map<string, InventoryDetail[]>();
    for (const r of visible) {
      const label = (r.location_id && locPaths.get(r.location_id)) || r.location_name || "";
      const key = label || "￿"; // unfiled sorts last
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, items]) => [k === "￿" ? "" : k, items] as const);
  }, [visible, locPaths]);

  const isLoading = !hydrated || (shelf === "stock" ? la : lh);

  return (
    <div className="pn6 mx-auto max-w-5xl space-y-4">
      <ScreenHead
        plate="STUFF"
        title="Everything"
        sub={shelf === "stock" ? "What is in the house, and where." : "Used up, expired or thrown out."}
        actions={
          <Link href="/add" className="btn-primary">
            <PlusCircle className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Add</span>
          </Link>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name or brand…"
          className="input pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={kind === null} onClick={() => setKind(null)} count={hydrated ? pool.length : null}>
          All
        </Chip>
        {KIND_ORDER.filter((k) => k !== "unsorted" || (hydrated && counts.unsorted > 0)).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)} count={hydrated ? counts[k] : null}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Seg
          value={shelf}
          onChange={setShelf}
          options={[
            ["stock", "In stock"],
            ["history", "History"],
          ]}
        />
        {shelf === "stock" && (
          <Seg
            value={view}
            onChange={setView}
            options={[
              ["place", "By place"],
              ["list", "List"],
            ]}
          />
        )}
      </div>

      {isLoading ? (
        <SkeletonRows n={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nothing here"
          hint={
            search || kind
              ? "Nothing matches this filter."
              : shelf === "stock"
                ? "Add food, supplies or the things you keep, and find them here by place."
                : "Nothing has been used up or thrown out yet."
          }
        />
      ) : shelf === "stock" && view === "list" ? (
        <InventoryTable rows={visible} />
      ) : shelf === "history" ? (
        <div className="space-y-2">
          {[...visible]
            .sort((a, b) => (b.finished_at ?? b.updated_at).localeCompare(a.finished_at ?? a.updated_at))
            .map((r) => (
              <StockCard key={r.id} row={r} />
            ))}
        </div>
      ) : (
        <div className="space-y-5">
          {byPlace.map(([label, items]) => (
            <section key={label || "unfiled"} className="min-w-0 space-y-2">
              <Section
                label={label || "No place yet"}
                right={<span className="meta">{items.length}</span>}
              />
              <div className="space-y-2">
                {items.map((r) => (
                  <StockCard key={r.id} row={r} hidePlace />
                ))}
              </div>
            </section>
          ))}
          <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-ink-3">
            <MapPin className="h-3.5 w-3.5" />
            <Link href="/places" className="hover:text-ink">
              Browse the house by place
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "chip ring-border transition-colors",
        active ? "bg-ink text-paper ring-ink" : "bg-surface text-text-muted hover:text-text",
      )}
    >
      {children}
      {count != null && <span className={cn("mono", active ? "opacity-70" : "text-ink-3")}>{count}</span>}
    </button>
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="flex rounded-[3px] border border-rule bg-surface-2 p-[3px]">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded-[3px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
            value === k
              ? "bg-surface text-ink shadow-[inset_0_-2px_0_var(--ink)]"
              : "text-text-muted hover:text-text",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function StuffPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading…</div>}>
      <StuffInner />
    </Suspense>
  );
}
