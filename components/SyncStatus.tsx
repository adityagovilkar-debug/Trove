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
          ? "bg-brand-100 text-brand-700 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-300"
          : "bg-amber-100 text-amber-700 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300"
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
