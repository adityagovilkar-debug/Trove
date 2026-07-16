"use client";

import { useRouter } from "next/navigation";
import { CookingPot, Home } from "lucide-react";
import { useSpace } from "@/lib/space";
import { cn } from "@/lib/utils";
import type { Space } from "@/lib/types";

// The Kitchen / Home pill. Switching also navigates to that space's dashboard,
// so it feels like flipping between two apps. `compact` = icons only (mobile
// header).
export function SpaceToggle({ compact = false }: { compact?: boolean }) {
  const { space, setSpace } = useSpace();
  const router = useRouter();

  function go(s: Space) {
    if (s === space) return;
    setSpace(s);
    router.push(s === "kitchen" ? "/" : "/home");
  }

  const opts: { key: Space; label: string; icon: typeof Home }[] = [
    { key: "kitchen", label: "Kitchen", icon: CookingPot },
    { key: "home", label: "Home", icon: Home },
  ];

  return (
    <div className="inline-flex rounded-full bg-surface-2 p-0.5" role="tablist" aria-label="Space">
      {opts.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={space === key}
          onClick={() => go(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-full py-1 text-xs font-medium transition-colors",
            compact ? "px-2" : "px-3",
            space === key
              ? "bg-brand-600 text-white"
              : "text-text-muted hover:text-text",
          )}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
