"use client";

import { Home } from "lucide-react";
import { toast } from "sonner";
import { useHouseholds, useHouseholdId, useSwitchHousehold } from "@/lib/queries";

// Lets a user who belongs to more than one household (e.g. their own personal
// household plus one they joined by share code) switch which one is active,
// on the fly — no sign-out required. Renders nothing for the common case of
// exactly one membership.
export function HouseholdSwitcher() {
  const { data: households = [] } = useHouseholds();
  const { data: active } = useHouseholdId();
  const switchTo = useSwitchHousehold();

  if (households.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <Home className="h-4 w-4 shrink-0 text-text-muted" />
      <select
        className="input"
        value={active ?? ""}
        onChange={(e) => {
          const hh = households.find((h) => h.household_id === e.target.value);
          switchTo(e.target.value);
          toast.success(`Switched to ${hh?.name ?? "household"}`);
        }}
        aria-label="Active household"
      >
        {households.map((h) => (
          <option key={h.household_id} value={h.household_id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}
