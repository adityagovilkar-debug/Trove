"use client";

import { useRouter } from "next/navigation";
import { CookingPot, Home } from "lucide-react";
import { useSpace } from "@/lib/space";
import { cn } from "@/lib/utils";
import type { Space } from "@/lib/types";

// The Kitchen / Home mode selector. Switching also navigates to that space's
// dashboard, so it feels like flipping between two apps. Each space carries
// its own pen (Kitchen = pn6, Home = pn2), shown as the active underline.
// `compact` = icons only (mobile header).
export function SpaceToggle({ compact = false }: { compact?: boolean }) {
  const { space, setSpace } = useSpace();
  const router = useRouter();

  function go(s: Space) {
    if (s === space) return;
    setSpace(s);
    router.push(s === "kitchen" ? "/" : "/home");
  }

  const opts: { key: Space; label: string; icon: typeof Home; pen: string }[] = [
    { key: "kitchen", label: "Kitchen", icon: CookingPot, pen: "pn6" },
    { key: "home", label: "Home", icon: Home, pen: "pn2" },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 rounded-[3px] border border-rule bg-surface-2 p-[3px]",
        compact ? "inline-grid" : "w-full",
      )}
      role="tablist"
      aria-label="Space"
    >
      {opts.map(({ key, label, icon: Icon, pen }) => {
        const on = space === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={on}
            onClick={() => go(key)}
            className={cn(
              pen,
              "flex items-center justify-center gap-1.5 rounded-[3px] py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
              compact ? "px-2" : "px-3",
              on ? "bg-surface text-ink" : "text-ink-3 hover:text-ink",
            )}
            style={on ? { boxShadow: "inset 0 -2px 0 var(--pen)" } : undefined}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" style={on ? { color: "var(--pen)" } : undefined} />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
