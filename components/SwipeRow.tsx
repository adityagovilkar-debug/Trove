"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  bg: string; // tailwind bg + text classes for the revealed action
  onAction: () => void;
}

// Touch swipe wrapper for list rows. Dragging right reveals/triggers `left`,
// dragging left reveals/triggers `right` (standard iOS-style pattern). No-ops
// with a mouse, so it's mobile-only by nature. Children must have an opaque
// background so the action behind doesn't show through.
export function SwipeRow({
  children,
  left,
  right,
  threshold = 72,
  className,
}: {
  children: ReactNode;
  left?: SwipeAction;
  right?: SwipeAction;
  threshold?: number;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef({ x: 0, y: 0, active: false });

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, active: true };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!start.current.active) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x;
    const my = t.clientY - start.current.y;
    if (Math.abs(mx) < Math.abs(my)) return; // vertical scroll wins
    let v = mx;
    if (v > 0 && !left) v = 0;
    if (v < 0 && !right) v = 0;
    setDx(Math.max(-110, Math.min(110, v)));
  }
  function onTouchEnd() {
    if (dx > threshold && left) left.onAction();
    else if (dx < -threshold && right) right.onAction();
    setDx(0);
    start.current.active = false;
  }

  const past = Math.abs(dx) > threshold;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {left && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center gap-2 px-5 text-sm font-medium transition-opacity",
            left.bg,
          )}
          style={{ opacity: dx > 4 ? 1 : 0 }}
        >
          {left.icon}
          <span className={past && dx > 0 ? "font-semibold" : ""}>{left.label}</span>
        </div>
      )}
      {right && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center gap-2 px-5 text-sm font-medium transition-opacity",
            right.bg,
          )}
          style={{ opacity: dx < -4 ? 1 : 0 }}
        >
          <span className={past && dx < 0 ? "font-semibold" : ""}>{right.label}</span>
          {right.icon}
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: start.current.active ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
