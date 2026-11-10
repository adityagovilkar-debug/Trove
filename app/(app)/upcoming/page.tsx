"use client";

import { useMemo } from "react";
import { Clock, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  useInventory,
  useSubscriptions,
  useMealPlans,
  useConsume,
  useMarkSubscriptionPaid,
} from "@/lib/queries";
import { buildUpcoming, bucketUpcoming, type UpcomingEvent, type UpcomingKind } from "@/lib/upcoming";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { ScreenHead, Section, Led } from "@/components/instrument";

const KIND_TAG: Record<UpcomingKind, string> = {
  expiry: "EXP",
  subscription: "PAY",
  warranty: "WTY",
  meal: "MEAL",
};

function dueLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
function dueTone(days: number): "bad" | "watch" | "ink" {
  if (days < 0) return "bad";
  if (days <= 3) return "watch";
  return "ink";
}
function toneClass(t: "bad" | "watch" | "ink") {
  return t === "bad" ? "text-bad" : t === "watch" ? "text-watch" : "text-ink-3";
}

export default function UpcomingPage() {
  const { data: inventory = [], isLoading: li } = useInventory({ status: "active" });
  const { data: subs = [], isLoading: ls } = useSubscriptions();
  const { data: meals = [] } = useMealPlans();
  const consume = useConsume();
  const markPaid = useMarkSubscriptionPaid();

  const buckets = useMemo(
    () => bucketUpcoming(buildUpcoming(inventory, subs, meals)),
    [inventory, subs, meals],
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
    <div className="pn5 mx-auto max-w-3xl space-y-6">
      <ScreenHead
        plate="UPCOMING"
        title="Upcoming"
        sub="Expiries, subscription payments and warranties — one timeline."
      />

      {isLoading ? (
        <SkeletonRows n={3} height="h-16" />
      ) : total === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nothing on the horizon"
          hint="No expiries, payments, or warranties coming up. You're all caught up."
        />
      ) : (
        buckets.map((bucket) => (
          <section key={bucket.label} className="space-y-2">
            <Section label={bucket.label} right={<span className="meta">{bucket.events.length}</span>} />
            <div className="card px-4 py-0">
              {bucket.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 border-t border-dotted border-rule-strong py-3 first:border-t-0"
                >
                  <Led tone={ev.kind === "meal" ? "good" : dueTone(ev.days)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{ev.title}</p>
                    <p className="truncate text-xs text-ink-3">
                      <span className="mono tracking-wider text-ink-3">{KIND_TAG[ev.kind]}</span>
                      {ev.subtitle ? ` · ${ev.subtitle}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="meta text-xs">{formatDate(ev.date)}</p>
                    <p className={cn("mono text-xs", toneClass(dueTone(ev.days)))}>{dueLabel(ev.days)}</p>
                  </div>
                  {ev.amount != null && (
                    <p className="mono w-16 shrink-0 text-right text-sm">
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
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
