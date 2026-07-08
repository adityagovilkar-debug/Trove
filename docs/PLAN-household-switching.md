# Plan: Active-household selection + on-the-fly switching

**Status:** ready to implement. No schema migration required.
**Estimated scope:** ~4 files touched, 1 new component. Frontend + one small API change.

## The bug being fixed

A second user (the owner's wife) joined the owner's household with the share
code. She still sees only her own data. Why:

- `handle_new_user` (supabase/migrations/0001_init.sql) creates a **personal
  household for every new signup**, seeded with default locations (Pantry,
  Refrigerator, Freezer, Kitchen Cabinet, Bathroom, Store Room).
- `useHouseholdId()` in `lib/queries.ts` (~line 85) resolves the user's
  household as: `household_members` filtered to the user, **ordered by
  membership `created_at` ascending, limit 1** — i.e. *the first household they
  ever belonged to*. For the wife that is her own personal household (created at
  signup, before she joined the owner's). Joining a household never changes
  what she sees.
- Every data hook in `lib/queries.ts` (~25 call sites) scopes queries with
  `.eq("household_id", householdId!)`, so she sees her own empty inventory and
  her own seeded default locations (which look identical to the owner's,
  causing the "she sees my locations but not my inventory" confusion).
- RLS is NOT the problem: `is_household_member()` policies already allow her to
  read every household she belongs to. This is purely client-side scoping.
- `app/api/push/subscribe/route.ts` has the same first-membership assumption
  when storing a push subscription's `household_id`.

## Goal

1. A user who belongs to multiple households has an **active household**,
   switchable on the fly (no sign-out, ideally no reload).
2. Joining a household by share code **auto-switches** to it — that alone fixes
   the wife's immediate confusion.
3. Push subscriptions follow the active household.

## Design

- **Active household = localStorage** (`trove-active-household`), validated
  against actual memberships, falling back to the first membership. Per-device
  is fine; do NOT add a DB column for this.
- All existing query keys already include `householdId`, so switching the
  resolved id naturally re-keys every query. No hook signatures change.

## Implementation steps

### 1. `lib/queries.ts` — memberships list + active resolution

Add near `useHouseholdId`:

```ts
const ACTIVE_KEY = "trove-active-household";

export interface HouseholdMembership {
  household_id: string;
  role: string;
  name: string; // household name
}

// All households the signed-in user belongs to (for the switcher UI).
export function useHouseholds() {
  return useQuery({
    queryKey: ["households"],
    staleTime: 60_000,
    queryFn: async (): Promise<HouseholdMembership[]> => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await sb
        .from("household_members")
        .select("household_id, role, created_at, households(name)")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => {
        const hh = m.households as unknown;
        const name = Array.isArray(hh)
          ? ((hh[0] as { name?: string } | undefined)?.name ?? "Household")
          : ((hh as { name?: string } | null)?.name ?? "Household");
        return { household_id: m.household_id, role: m.role, name };
      });
    },
  });
}
```

Rewrite `useHouseholdId`'s queryFn to resolve the **active** membership:

```ts
export function useHouseholdId() {
  return useQuery({
    queryKey: ["household-id"],
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      const sb = supabaseBrowser();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await sb
        .from("household_members")
        .select("household_id")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.household_id as string);
      if (ids.length === 0) throw new Error("No household");
      // Preferred: the stored active household, if still a member of it.
      try {
        const stored = localStorage.getItem(ACTIVE_KEY);
        if (stored && ids.includes(stored)) return stored;
      } catch {}
      return ids[0];
    },
  });
}
```

Add the switch hook:

```ts
// Switch the active household: persist the choice, swap the resolved id, and
// re-fetch everything (all query keys embed the household id).
export function useSwitchHousehold() {
  const qc = useQueryClient();
  return (householdId: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, householdId);
    } catch {}
    qc.setQueryData(["household-id"], householdId);
    qc.invalidateQueries();
  };
}
```

Notes:
- `qc.invalidateQueries()` (no filter) is deliberate: cheap, and guarantees
  nothing stale survives the switch.
- Do NOT try to clear the persisted offline cache; keys differ per household so
  there is no bleed-through.

### 2. New `components/HouseholdSwitcher.tsx`

A small select rendered ONLY when `useHouseholds()` returns ≥ 2 memberships:

```tsx
"use client";
import { Home } from "lucide-react";
import { toast } from "sonner";
import { useHouseholds, useHouseholdId, useSwitchHousehold } from "@/lib/queries";

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
```

### 3. Mount the switcher

- `components/AppShell.tsx`: in the desktop sidebar footer block (the div with
  the user name/email + ThemeToggle, around line 91), render
  `<HouseholdSwitcher />` above the name/email row. That gives desktop an
  always-visible switcher.
- `app/(app)/settings/page.tsx`: in the **Household** section card, render
  `<HouseholdSwitcher />` at the top (this covers mobile, where the sidebar
  doesn't exist). Add a one-line hint like "You're in more than one household —
  choose which one you're viewing."

### 4. Auto-switch after joining (`app/(app)/settings/page.tsx`)

In `joinHousehold()` (currently inserts into `household_members`, clears the
query cache and reloads): after a successful insert, persist the joined id
before reloading:

```ts
try { localStorage.setItem("trove-active-household", code); } catch {}
```

Keep the existing `qc.clear()` + `window.location.reload()` — the reload will
resolve `useHouseholdId` to the stored value. This single line is what fixes
the reported bug for the wife (re-joining isn't needed; she can just use the
switcher, but new joiners get the right view immediately).

Also worth doing in the same file: the "Share code" block shares the ACTIVE
household's id. Add a hint under it: "Sharing the code for <household name>"
(get the name from `useHouseholds()`), so an owner switched into another
household doesn't accidentally share the wrong code.

### 5. Push subscription follows the active household

- `components/NotificationToggle.tsx`: it POSTs `{ subscription }` to
  `/api/push/subscribe`. Include the active household:
  `const { data: householdId } = useHouseholdId();` and send
  `{ subscription: sub, householdId }`.
- `app/api/push/subscribe/route.ts`: accept `householdId` from the body.
  **Validate it server-side** — look up
  `household_members` for `(user_id = user.id, household_id = body.householdId)`
  with `.limit(1).maybeSingle()`; use it only if the membership exists,
  otherwise fall back to the existing first-membership query. Never trust the
  client id without that check.
- Optional nicety (skip if time-boxed): calling `useSwitchHousehold` could
  re-POST an existing subscription so digests follow the switch; without it the
  device keeps digesting the household that was active when notifications were
  enabled. Acceptable v1 behavior — document it in the commit message.

### 6. What NOT to do

- No schema migration. RLS already permits everything needed
  (`households_member_read` covers reading household names for the switcher;
  `profiles_comembers` covers the Members list).
- Don't add `active_household_id` to profiles — localStorage is enough and
  avoids cross-device write churn.
- Don't attempt "merge households" or "leave household" in this change. (A
  "Leave household" button is a sensible follow-up, but it needs owner/last-
  member guard rails; keep it out of scope.)
- Don't touch `app/api/push/send/route.ts` — it already fans out per
  subscription row's `household_id`.

## Verification (what CAN be checked without a second account)

1. `npx tsc --noEmit` and `npm run build` pass (run from `larder/`).
2. Grep: no remaining `.limit(1)`-first-membership resolution inside
   `useHouseholdId` other than as the documented fallback.
3. With a single-membership user, `HouseholdSwitcher` renders nothing
   (guard: `households.length < 2`).
4. Code-review the switch path: `localStorage` write → `setQueryData` →
   `invalidateQueries()`; every data hook keys on `householdId` so the swap
   re-fetches all of it.

## Manual test script for the user (include in the completion summary)

1. Wife opens Settings → sees the new switcher (she has 2 households) →
   selects the shared household → inventory/locations/shopping now show the
   shared data, without signing out.
2. She switches back → sees her own (empty) household again.
3. On the owner's device nothing visibly changes (single... he may also join
   hers later; switcher appears only with ≥2 memberships).
4. If she re-enables notifications after switching, her daily digest follows
   the shared household.

## Commit

One commit, message along the lines of:
"Add active-household switching; auto-switch after joining by code".
Repo rule: verify `git diff --cached` contains no secrets before committing;
push to `main` (Vercel deploys automatically).
