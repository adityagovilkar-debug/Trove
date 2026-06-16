"use client";

import { useMemo } from "react";
import { Clock, CreditCard, ShieldCheck, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useSubscriptions,
  useConsume,
  useMarkSubscriptionPaid,
} from "@/lib/queries";
import { buildUpcoming, bucketUpcoming, type UpcomingEvent } from "@/lib/upcoming";
import { cn, formatDate, formatMoney } from "@/lib/utils";

const KIND = {
  expiry: { icon: Clock, tint: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  subscription: { icon: CreditCard, tint: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" },
  warranty: { icon: ShieldCheck, tint: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
} as const;

function dueLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
function dueColor(days: number) {
  if (days < 0) return "text-rose-500";
  if (days <= 3) return "text-orange-500";
  if (days <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-text-muted";
}

export default function UpcomingPage() {
  const { data: inventory = [], isLoading: li } = useInventory({ status: "active" });
  const { data: subs = [], isLoading: ls } = useSubscriptions();
  const consume = useConsume();
  const markPaid = useMarkSubscriptionPaid();

  const buckets = useMemo(
    () => bucketUpcoming(buildUpcoming(inventory, subs)),
    [inventory, subs],
  );
  const isLoading = li || ls;
  const total = buckets.reduce((n, b) => n + b.events.length, 0);

  function action(ev: UpcomingEvent) {
    if (ev.kind === "expiry" && ev.inventory) {
      consume.mutate(
        { id: ev.inventory.id, quantity: Number(ev.inventory.quantity) },
        { onSuccess: () => toast.success(`Used 1 ${ev.title}`) },
      );
    } else if (ev.kind === "subscription" && ev.subscription) {
      markPaid.mutate(ev.subscription, {
        onSuccess: () => toast.success(`Recorded payment for ${ev.title}`),
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
        <p className="text-sm text-text-muted">
          Expiries, subscription payments and warranties — in one timeline.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="card p-10 text-center text-sm text-text-muted">
          Nothing on the horizon — no expiries, payments or warranties coming up.
        </div>
      ) : (
        buckets.map((bucket) => (
          <section key={bucket.label} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {bucket.label}
              <span className="ml-2 font-normal normal-case">{bucket.events.length}</span>
            </h2>
            <div className="space-y-2">
              {bucket.events.map((ev) => {
                const meta = KIND[ev.kind];
                const Icon = meta.icon;
                return (
                  <div key={ev.id} className="card flex items-center gap-3 p-3">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ev.title}</p>
                      <p className="truncate text-xs text-text-muted">{ev.subtitle}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm">{formatDate(ev.date)}</p>
                      <p className={cn("text-xs font-medium", dueColor(ev.days))}>{dueLabel(ev.days)}</p>
                    </div>
                    {ev.amount != null && (
                      <p className="w-16 shrink-0 text-right text-sm font-medium">
                        {formatMoney(ev.amount, ev.currency ?? "INR")}
                      </p>
                    )}
                    {ev.kind === "expiry" && (
                      <button onClick={() => action(ev)} className="btn-outline shrink-0 px-2.5 py-1.5" title="Use one">
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                    {ev.kind === "subscription" && (
                      <button onClick={() => action(ev)} className="btn-outline shrink-0 px-2.5 py-1.5" title="Mark paid">
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
