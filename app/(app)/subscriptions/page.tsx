"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  CreditCard,
  CalendarClock,
  Wallet,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSubscriptions,
  useDeleteSubscription,
  useMarkSubscriptionPaid,
} from "@/lib/queries";
import {
  monthlyCost,
  yearlyCost,
  daysUntil,
  BILLING_CYCLES,
} from "@/lib/subscriptions";
import { SubscriptionDialog } from "@/components/SubscriptionDialog";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import type { Subscription } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";

export default function SubscriptionsPage() {
  const { data: subs = [], isLoading } = useSubscriptions();
  const del = useDeleteSubscription();
  const markPaid = useMarkSubscriptionPaid();
  const [dialog, setDialog] = useState<{ open: boolean; sub?: Subscription | null }>({
    open: false,
  });

  const active = subs.filter((s) => s.status === "active");
  const totals = useMemo(() => {
    const monthly = active.reduce((s, x) => s + monthlyCost(x), 0);
    const yearly = active.reduce((s, x) => s + yearlyCost(x), 0);
    return { monthly, yearly };
  }, [active]);
  const currency = subs[0]?.currency ?? "INR";

  const nextDue = active
    .filter((s) => s.next_payment)
    .sort((a, b) => (a.next_payment! < b.next_payment! ? -1 : 1))[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {dialog.open && (
        <SubscriptionDialog
          sub={dialog.sub}
          onClose={() => setDialog({ open: false })}
        />
      )}

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-text-muted">Your recurring payments at a glance.</p>
        </div>
        <button className="btn-primary" onClick={() => setDialog({ open: true, sub: null })}>
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label="Per month" value={formatMoney(totals.monthly, currency)} />
        <Stat icon={CreditCard} label="Per year" value={formatMoney(totals.yearly, currency)} />
        <Stat icon={CalendarClock} label="Active" value={active.length} />
        <Stat
          icon={CalendarClock}
          label="Next payment"
          value={nextDue ? formatDate(nextDue.next_payment) : "—"}
          sub={nextDue?.name}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : subs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No subscriptions yet"
          hint="Track Netflix, your phone plan, gym — anything recurring — to see your monthly burn."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Cycle</th>
                <th className="px-4 py-3 font-medium">/ month</th>
                <th className="px-4 py-3 font-medium">Next payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const d = daysUntil(s.next_payment);
                const cycleLabel =
                  BILLING_CYCLES.find((c) => c.value === s.billing_cycle)?.label ??
                  s.billing_cycle;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      {s.category && (
                        <div className="text-xs text-text-muted">{s.category}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatMoney(s.price, s.currency)}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {s.billing_cycle === "custom" ? `Every ${s.cycle_days}d` : cycleLabel}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatMoney(monthlyCost(s), s.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {s.next_payment ? (
                        <div>
                          <div>{formatDate(s.next_payment)}</div>
                          {s.status === "active" && d != null && (
                            <span
                              className={cn(
                                "text-xs",
                                d < 0
                                  ? "text-rose-500"
                                  : d <= 3
                                    ? "text-orange-500"
                                    : "text-text-muted",
                              )}
                            >
                              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "due today" : `in ${d}d`}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "chip ring-inset",
                          s.status === "active"
                            ? "bg-brand-100 text-brand-700 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-300"
                            : "bg-surface-2 text-text-muted ring-border",
                        )}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.status === "active" && s.next_payment && (
                          <button
                            className="btn-outline px-2 py-1.5"
                            title="Mark paid (advance to next cycle)"
                            onClick={() =>
                              markPaid.mutate(s, {
                                onSuccess: () => toast.success(`Recorded payment for ${s.name}`),
                              })
                            }
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="btn-ghost px-2 py-1.5"
                          title="Edit"
                          onClick={() => setDialog({ open: true, sub: s })}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn-ghost px-2 py-1.5 text-rose-500"
                          title="Delete"
                          onClick={() => del.mutate(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 inline-flex rounded-lg bg-brand-100 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon className="h-5 w-5" />
      </div>
      <p className="truncate text-xl font-semibold tracking-tight">{value}</p>
      <p className="truncate text-xs text-text-muted">{sub ? `${label} · ${sub}` : label}</p>
    </div>
  );
}
