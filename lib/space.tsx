"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Domain, Space } from "./types";

// The app is split into two "spaces": Kitchen (the food pantry — churny,
// expiry-driven) and Home (durables & utilities — the calm half). The active
// space is per-device UI state, remembered in localStorage; each space has its
// own nav and dashboard, while search and settings stay global.

const KEY = "trove-space";

const SpaceCtx = createContext<{ space: Space; setSpace: (s: Space) => void }>({
  space: "kitchen",
  setSpace: () => {},
});

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  // Start on Kitchen for a hydration-safe first paint, then adopt the stored
  // choice (the swap is immediate and pre-interaction).
  const [space, set] = useState<Space>("kitchen");
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s === "home" || s === "kitchen") set(s);
    } catch {
      // localStorage unavailable — stay on the default
    }
  }, []);

  function setSpace(s: Space) {
    set(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      // best-effort persistence
    }
  }

  return <SpaceCtx.Provider value={{ space, setSpace }}>{children}</SpaceCtx.Provider>;
}

export function useSpace() {
  return useContext(SpaceCtx);
}

// Which space an inventory row belongs to. Falls back to the domain key when
// the view predates migration 0013, so the app degrades gracefully.
export function rowSpace(r: {
  domain_space?: Space | null;
  domain_key?: string | null;
}): Space {
  if (r.domain_space) return r.domain_space;
  return r.domain_key === "grocery" ? "kitchen" : "home";
}

// Which space a domain belongs to (same pre-migration fallback).
export function domainSpace(d: Pick<Domain, "space" | "key">): Space {
  if (d.space) return d.space;
  return d.key === "grocery" ? "kitchen" : "home";
}
