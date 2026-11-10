"use client";

import { useEffect, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";

// Small header pill: shows when you're offline and/or have writes waiting to
// sync. Hidden entirely when online and fully synced.
export function SyncStatus() {
  const [online, setOnline] = useState(true);
  const pending = useIsMutating();

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <span
      className={`chip shrink-0 ring-inset ${
        online
          ? "bg-surface-2 text-ink-3 ring-border"
          : "bg-watch/12 text-watch ring-watch/30"
      }`}
      title={
        online
          ? "Saving your changes…"
          : "You're offline — changes are saved here and will sync when you reconnect."
      }
    >
      {online ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing{pending > 1 ? ` ${pending}` : ""}
        </>
      ) : (
        <>
          <CloudOff className="h-3 w-3" />
          Offline{pending > 0 ? ` · ${pending} queued` : ""}
        </>
      )}
    </span>
  );
}
