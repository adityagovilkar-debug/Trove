"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// False during server rendering and the hydration pass, true afterwards.
// The offline cache can hand the browser data the server never had, so
// anything rendered from that data waits for this — otherwise the first
// browser render disagrees with the server HTML (a hydration mismatch).
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
