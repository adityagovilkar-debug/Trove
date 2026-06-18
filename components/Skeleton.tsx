import { cn } from "@/lib/utils";

// Standardized loading placeholders used across the app.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} />;
}

// A list of card-shaped skeletons for loading lists.
export function SkeletonRows({ n = 3, height = "h-[68px]" }: { n?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-2xl", height)} />
      ))}
    </div>
  );
}
