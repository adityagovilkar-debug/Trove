"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import { useInventory, useRefData } from "@/lib/queries";
import { StockCard } from "@/components/StockCard";
import { InventoryTable } from "@/components/InventoryTable";
import { cn } from "@/lib/utils";
import type { InventoryStatus } from "@/lib/types";

const STATUS_TABS: { key: InventoryStatus | "all"; label: string }[] = [
  { key: "active", label: "In stock" },
  { key: "finished", label: "Finished" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

function InventoryInner() {
  const params = useSearchParams();
  const expiringOnly = params.get("filter") === "expiring";

  const [status, setStatus] = useState<InventoryStatus | "all">("active");
  const [domainId, setDomainId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: ref } = useRefData();
  const { data: rows = [], isLoading } = useInventory({ status, domainId, search });

  const visible = useMemo(() => {
    if (!expiringOnly) return rows;
    return rows.filter((r) => r.days_to_expiry != null && r.days_to_expiry <= 7);
  }, [rows, expiringOnly]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-text-muted">
            {expiringOnly ? "Showing items expiring within a week." : "Everything you own."}
          </p>
        </div>
        <Link href="/add" className="btn-primary">
          <PlusCircle className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add</span>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              status === t.key
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + domain filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name…"
            className="input pl-10"
          />
        </div>
        {ref && ref.domains.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={domainId === null} onClick={() => setDomainId(null)}>
              All types
            </FilterChip>
            {ref.domains.map((d) => (
              <FilterChip
                key={d.id}
                active={domainId === d.id}
                onClick={() => setDomainId(d.id)}
              >
                {d.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-[68px] animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-text-muted">
          Nothing here. {status === "active" && "Add some stock to get started."}
        </div>
      ) : status === "active" ? (
        // Active stock: product-grouped table (sum lots, expand to purchases).
        <InventoryTable rows={visible} />
      ) : (
        // History (finished/expired/all): flat list of individual entries.
        <>
          <p className="text-xs text-text-muted">{visible.length} entries</p>
          <div className="space-y-2">
            {visible.map((r) => (
              <StockCard key={r.id} row={r} />
            ))}
          </div>
        </>
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

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-text-muted">Loading…</div>}>
      <InventoryInner />
    </Suspense>
  );
}
