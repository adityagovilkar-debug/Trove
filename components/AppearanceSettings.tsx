"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";

const MODES: { id: Mode; label: string; sub: string; icon: typeof Sun }[] = [
  { id: "light", label: "Paper", sub: "Light", icon: Sun },
  { id: "dark", label: "Backlit", sub: "Dark", icon: Moon },
];

// Reads/writes the light/dark flag the pre-paint script in layout.tsx applies:
// the `.dark` class + localStorage `trove-theme`. Trove uses the single
// Instrument aesthetic in two lightings — Paper and Backlit.
export function AppearanceSettings() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function applyMode(m: Mode) {
    setMode(m);
    document.documentElement.classList.toggle("dark", m === "dark");
    localStorage.setItem("trove-theme", m);
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Appearance</h2>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => applyMode(m.id)}
            className={cn(
              "flex items-center gap-3 border p-3 text-left transition-colors",
              mode === m.id ? "border-ink" : "border-rule hover:bg-surface-2",
            )}
            style={{ borderRadius: "var(--r)" }}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center border",
                mode === m.id ? "bg-ink text-paper" : "text-ink-3",
              )}
              style={{ borderRadius: "var(--r)" }}
            >
              <m.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-[11px] uppercase tracking-[0.12em] text-ink-3">
                {m.sub}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
