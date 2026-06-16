"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useRefData, useUpsertSubscription } from "@/lib/queries";
import {
  BILLING_CYCLES,
  SUBSCRIPTION_CATEGORIES,
} from "@/lib/subscriptions";
import type { BillingCycle, Subscription, SubscriptionStatus } from "@/lib/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

export function SubscriptionDialog({
  sub,
  onClose,
}: {
  sub?: Subscription | null;
  onClose: () => void;
}) {
  const { data: ref } = useRefData();
  const upsert = useUpsertSubscription();

  const [name, setName] = useState(sub?.name ?? "");
  const [category, setCategory] = useState(sub?.category ?? "");
  const [price, setPrice] = useState(sub ? String(sub.price) : "");
  const [currency, setCurrency] = useState(
    sub?.currency ?? ref?.household.base_currency ?? "INR",
  );
  const [cycle, setCycle] = useState<BillingCycle>(sub?.billing_cycle ?? "monthly");
  const [cycleDaysV, setCycleDaysV] = useState(sub?.cycle_days ? String(sub.cycle_days) : "30");
  const [nextPayment, setNextPayment] = useState(sub?.next_payment ?? "");
  const [startDate, setStartDate] = useState(sub?.start_date ?? "");
  const [method, setMethod] = useState(sub?.payment_method ?? "");
  const [status, setStatus] = useState<SubscriptionStatus>(sub?.status ?? "active");
  const [notes, setNotes] = useState(sub?.notes ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    upsert.mutate(
      {
        id: sub?.id,
        name: name.trim(),
        category: category || null,
        price: Number(price) || 0,
        currency,
        billing_cycle: cycle,
        cycle_days: cycle === "custom" ? Number(cycleDaysV) || 30 : null,
        next_payment: nextPayment || null,
        start_date: startDate || null,
        payment_method: method.trim() || null,
        status,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(sub ? "Subscription updated" : "Subscription added");
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't save"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <p className="font-semibold">{sub ? "Edit subscription" : "New subscription"}</p>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4 overflow-y-auto p-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, iCloud, Gym"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {SUBSCRIPTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="label">Price</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="per cycle"
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Billing cycle</label>
              <select
                className="input"
                value={cycle}
                onChange={(e) => setCycle(e.target.value as BillingCycle)}
              >
                {BILLING_CYCLES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {cycle === "custom" ? (
              <div>
                <label className="label">Every N days</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={cycleDaysV}
                  onChange={(e) => setCycleDaysV(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="label">Payment method</label>
                <input
                  className="input"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  placeholder="e.g. HDFC card"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Next payment</label>
              <input
                className="input"
                type="date"
                value={nextPayment}
                onChange={(e) => setNextPayment(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Started on</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {cycle === "custom" && (
            <div>
              <label className="label">Payment method</label>
              <input
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="e.g. HDFC card"
              />
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
