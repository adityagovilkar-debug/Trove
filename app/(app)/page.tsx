"use client";

import Link from "next/link";
import {
  Boxes,
  TriangleAlert,
  CircleSlash,
  Wallet,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { useInventory } from "@/lib/queries";
import { StockCard } from "@/components/StockCard";
import { formatMoney } from "@/lib/utils";

export default function DashboardPage() {
  const { data: active = [], isLoading } = useInventory({ status: "active" });

  const expiringSoon = active
    .filter((r) => r.days_to_expiry != null && r.days_to_expiry <= 7)
    .sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0));
  const expired = active.filter(
    (r) => r.days_to_expiry != null && r.days_to_expiry < 0,
  );
  const totalValue = active.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const recent = [...active]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-text-muted">Your home at a glance.</p>
        </div>
        <Link href="/add" className="btn-primary">
          <PlusCircle className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add stock</span>
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Boxes}
          label="Items in stock"
          value={active.length}
          tone="brand"
        />
        <Stat
          icon={TriangleAlert}
          label="Expiring ≤ 7 days"
          value={expiringSoon.length - expired.length < 0 ? 0 : expiringSoon.length - expired.length}
          tone="amber"
        />
        <Stat
          icon={CircleSlash}
          label="Already expired"
          value={expired.length}
          tone="rose"
        />
        <Stat
          icon={Wallet}
          label="Value on hand"
          value={formatMoney(totalValue, active[0]?.currency ?? "INR")}
          tone="slate"
        />
      </div>

      {/* Expiring soon */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TriangleAlert className="h-5 w-5 text-amber-500" />
            Use these soon
          </h2>
          <Link
            href="/inventory?filter=expiring"
            className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {isLoading ? (
          <SkeletonList />
        ) : expiringSoon.length === 0 ? (
          <Empty text="Nothing's about to expire. Nicely managed. 🎉" />
        ) : (
          <div className="space-y-2">
            {expiringSoon.slice(0, 6).map((r) => (
              <StockCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      {/* Recently added */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recently added</h2>
        {isLoading ? (
          <SkeletonList />
        ) : recent.length === 0 ? (
          <Empty text="No stock yet — add your first item to get started." />
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <StockCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  slate: "bg-surface-2 text-text-muted",
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number | string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="card p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card p-8 text-center text-sm text-text-muted">{text}</div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-[68px] animate-pulse" />
      ))}
    </div>
  );
}
