import { cn } from "@/lib/utils";

// The Trove mark: an open box (your store of things) with a gem rising out of
// it — a "trove". Rendered inline (not an <img>) so the tile recolors with the
// active aesthetic: terracotta in Warm Pantry, honey in Midnight, and — via the
// `.bg-brand-600.text-white` override in globals.css — lime with an ink glyph
// and square corners in Neo Brutalist.
export function TroveMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center bg-brand-600 text-white",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="h-[62%] w-[62%]" fill="currentColor">
        <path d="M24 8 L31 15 L24 22 L17 15 Z" />
        <rect x="12" y="24" width="24" height="3" rx="1.5" />
        <rect x="12" y="28.5" width="24" height="11.5" rx="3" />
      </svg>
    </span>
  );
}
