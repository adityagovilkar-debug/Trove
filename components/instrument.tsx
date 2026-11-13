"use client";

import { cn } from "@/lib/utils";

// Instrument primitives for Trove — dots instead of bars (the unlit track is
// always drawn so the scale reads), mono figures, readout banks, panels with
// corner tics. Motion lives in globals.css and stops under reduced-motion.

/** A headline figure whose characters roll into place; re-rolls on change. */
export function Odometer({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("odo", className)} key={text} aria-label={text}>
      {text.split("").map((c, i) => (
        <span key={i} aria-hidden="true" style={{ animationDelay: `${40 + i * 38}ms` }}>
          {c}
        </span>
      ))}
    </span>
  );
}

/** A figure with a small leading/trailing unit. */
export function Figure({
  value,
  unit,
  unitAfter,
  className,
}: {
  value: string;
  unit?: string;
  unitAfter?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline", className)}>
      {unit && <span className="u mr-0.5">{unit}</span>}
      <Odometer text={value} />
      {unitAfter && <span className="u">{unitAfter}</span>}
    </div>
  );
}

/** A row of dots lit left-to-right by `frac`; dots past 100% turn red. */
export function DotMeter({
  frac,
  n = 24,
  width = 220,
  color = "var(--pen)",
  label,
  className,
}: {
  frac: number;
  n?: number;
  width?: number;
  color?: string;
  label: string;
  className?: string;
}) {
  const step = width / n;
  const lit = Math.min(n, Math.round(Math.max(0, frac) * n));
  const over = frac > 1 ? Math.min(Math.round((frac - 1) * n), 6) : 0;
  const total = n + over;
  const w = total * step;
  return (
    <svg
      width={w}
      height={14}
      viewBox={`0 0 ${w} 14`}
      role="img"
      aria-label={label}
      className={cn("block max-w-full", className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const x = i * step + step / 2;
        const on = i < lit || i >= n;
        return on ? (
          <circle
            key={i}
            className="dt"
            cx={x}
            cy={7}
            r={Math.min(2.6, step / 3)}
            style={{
              fill: i >= n ? "var(--bad)" : color,
              animationDelay: `${160 + Math.min(i, 20) * 28}ms`,
            }}
          />
        ) : (
          <circle key={i} cx={x} cy={7} r={1.3} style={{ fill: "var(--ink-4)" }} />
        );
      })}
    </svg>
  );
}

/** Proportion as dots round a circle, clockwise from 12 o'clock. */
export function DotRing({
  frac,
  size = 46,
  n = 32,
  color = "var(--pen)",
  label,
  children,
}: {
  frac: number;
  size?: number;
  n?: number;
  color?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const c = size / 2;
  const R = c - 4;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {Array.from({ length: n }, (_, i) => {
          const t = i / n;
          const a = -Math.PI / 2 + t * Math.PI * 2;
          const x = Math.round((c + Math.cos(a) * R) * 100) / 100;
          const y = Math.round((c + Math.sin(a) * R) * 100) / 100;
          return t < f ? (
            <circle
              key={i}
              className="dt"
              cx={x}
              cy={y}
              r={1.5 + 0.6 * (t / f)}
              opacity={0.5 + 0.5 * (t / f)}
              style={{ fill: color, animationDelay: `${180 + i * 22}ms` }}
            />
          ) : (
            <circle key={i} cx={x} cy={y} r={1} style={{ fill: "var(--ink-4)" }} />
          );
        })}
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

/** History as dot columns: √-scaled, heavier cap dot, zero still ticks. */
export function DotCols({
  values,
  width = 340,
  height = 56,
  color = "var(--pen)",
  lastColor = "var(--ink)",
  label,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  lastColor?: string;
  label: string;
  className?: string;
}) {
  if (values.length === 0) return null;
  const step = 3.3;
  const rows = Math.floor((height - 4) / step);
  const cw = width / values.length;
  const max = Math.max(1e-9, ...values);
  // Few values → each column becomes a small dot matrix (up to 5 dots wide)
  // so a 6-month chart doesn't read as two lonely specks.
  const across = Math.max(1, Math.min(5, Math.floor((cw * 0.55) / step)));
  const dots: React.ReactNode[] = [];
  values.forEach((v, i) => {
    const cx = i * cw + cw / 2;
    const scaled = Math.sqrt(Math.max(0, v) / max);
    const lit = v > 0 ? Math.max(1, Math.round(scaled * rows)) : 0;
    const isLast = i === values.length - 1;
    for (let k = 0; k < across; k++) {
      const x = cx + (k - (across - 1) / 2) * step;
      for (let j = 0; j < rows; j++) {
        const y = height - 2 - j * step;
        if (j >= lit) {
          // Unlit track — always drawn so the scale reads, even at zero.
          dots.push(
            <circle key={`${i}-${k}-${j}`} cx={x} cy={y} r={0.75} style={{ fill: "var(--ink-4)" }} opacity={0.55} />,
          );
          continue;
        }
        const top = j === lit - 1;
        dots.push(
          <circle
            key={`${i}-${k}-${j}`}
            className="dt"
            cx={x}
            cy={y}
            r={top ? 1.6 : 1.05}
            opacity={top ? 1 : 0.28 + (0.5 * j) / rows}
            style={{ fill: isLast ? lastColor : color, animationDelay: `${140 + Math.min(i, 30) * 16}ms` }}
          />,
        );
      }
    }
  });
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cn("block max-w-full", className)}
    >
      {dots}
    </svg>
  );
}

/** Segmented control; the marker glides between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cn("seg", className)}>
      <span
        className="glide"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A section heading: a label with a trailing dotted rule, optional right slot. */
export function Section({
  label,
  right,
  className,
}: {
  label: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <h2 className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        {label}
      </h2>
      <span className="h-px flex-1 border-t border-dotted border-rule-strong" />
      {right}
    </div>
  );
}

/** Screen header: a pen-coloured plate id, the title, optional actions. */
export function ScreenHead({
  plate,
  title,
  sub,
  pen,
  actions,
  className,
}: {
  plate?: string;
  title: string;
  sub?: React.ReactNode;
  pen?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", pen, className)}>
      <div className="min-w-0">
        {plate && <div className="no">{plate}</div>}
        <h1 className="title mt-1 truncate">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A panel ("unit"): hairline card with corner tics + an optional header. */
export function Unit({
  label,
  meta,
  pen,
  className,
  bodyClassName,
  children,
}: {
  label?: string;
  meta?: React.ReactNode;
  pen?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("card p-4", pen, className)}>
      {(label || meta) && (
        <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-rule pb-2.5">
          {label && (
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {label}
            </h2>
          )}
          {meta && <span className="meta ml-auto">{meta}</span>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** A bank of labelled readouts (mono values). */
export function Readouts({
  items,
  cols = 2,
  className,
}: {
  items: { k: string; v: React.ReactNode; pen?: string }[];
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("readouts", className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={i} className={cn("ro", it.pen)}>
          <span className="k">{it.k}</span>
          <span className="v" style={it.pen ? { color: "var(--pen)" } : undefined}>
            {it.v}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A small status LED. */
export function Led({ tone = "ink", pulse }: { tone?: "good" | "watch" | "bad" | "ink"; pulse?: boolean }) {
  const color =
    tone === "good" ? "var(--good)" : tone === "watch" ? "var(--watch)" : tone === "bad" ? "var(--bad)" : "var(--ink-3)";
  return <span className={cn("led", pulse && "pulse")} style={{ background: color }} aria-hidden="true" />;
}
