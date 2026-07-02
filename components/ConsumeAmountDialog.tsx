"use client";

import { useState } from "react";
import { X, Minus } from "lucide-react";
import { toast } from "sonner";
import { useConsume } from "@/lib/queries";

// Use a specific amount of a stock lot — for things you don't finish one unit
// at a time (drank 200 ml of the 1 L juice). Draws from the given lot; when it
// hits zero the lot auto-finishes, same as "Use 1".
export function ConsumeAmountDialog({
  lot,
  onClose,
}: {
  lot: { id: string; name: string; quantity: number; unit: string | null };
  onClose: () => void;
}) {
  const consume = useConsume();
  const max = Number(lot.quantity) || 0;
  const [amount, setAmount] = useState(String(Math.min(1, max)));
  const unit = lot.unit ? ` ${lot.unit}` : "";

  function use(amt: number) {
    const a = Math.min(Math.max(amt, 0), max);
    if (a <= 0) return;
    consume.mutate(
      { id: lot.id, quantity: max, amount: a },
      {
        onSuccess: (res) => {
          toast.success(
            res.finished
              ? `Finished ${lot.name}`
              : `Used ${round(a)}${unit} · ${round(res.remaining)}${unit} left`,
          );
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl border bg-bg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b bg-surface px-4 py-3">
          <div>
            <p className="font-semibold">Use amount</p>
            <p className="text-xs text-text-muted">
              {lot.name} · {round(max)}{unit} in stock
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-2 py-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            use(Number(amount) || 0);
          }}
          className="space-y-4 p-4"
        >
          <div>
            <label className="label">Amount to use{unit && ` (${lot.unit})`}</label>
            <input
              className="input"
              type="number"
              min="0"
              max={max}
              step="any"
              value={amount}
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "1", amt: 1 },
              { label: "Half", amt: round(max / 2) },
              { label: "All", amt: max },
            ]
              .filter((q) => q.amt > 0 && q.amt <= max)
              .map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setAmount(String(q.amt))}
                  className="chip bg-surface-2 text-text-muted ring-border ring-inset hover:text-text"
                >
                  {q.label}
                </button>
              ))}
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={consume.isPending}>
              <Minus className="h-4 w-4" />
              Use it
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

function round(n: number) {
  return Math.round(n * 100) / 100;
}
