import type { Domain, Space } from "./types";

// Every kind of thing is either a consumable (food: churns, expires) or a
// kept thing. The old Kitchen/Home mode switch is gone; this is now just a
// property of the item, used to filter lists (Pantry = food, Things = the rest).

// Which side an inventory row belongs to. Falls back to the domain key when
// the view predates migration 0013.
export function rowSpace(r: {
  domain_space?: Space | null;
  domain_key?: string | null;
}): Space {
  if (r.domain_space) return r.domain_space;
  return r.domain_key === "grocery" ? "kitchen" : "home";
}

// Which side a domain belongs to (same fallback).
export function domainSpace(d: Pick<Domain, "space" | "key">): Space {
  if (d.space) return d.space;
  return d.key === "grocery" ? "kitchen" : "home";
}
