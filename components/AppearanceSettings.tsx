"use client";

import { useEffect, useState } from "react";
import { Check, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Aesthetic = "warm" | "brutalist";
type Mode = "light" | "dark";

const AESTHETICS: {
  id: Aesthetic;
  name: string;
  desc: string;
  swatches: [string, string, string];
}[] = [
  {
    id: "warm",
    name: "Warm Pantry",
    desc: "Cozy cream & terracotta · midnight in the dark",
    swatches: ["#fbf6ee", "#c2410c", "#17171c"],
  },
  {
    id: "brutalist",
    name: "Neo Brutalist",
    desc: "Hard edges, bold borders, electric lime",
    swatches: ["#ffffff", "#b6e400", "#141414"],
  },
];

// Reads/writes the same flags the pre-paint script in layout.tsx applies:
// `.dark` class + localStorage `trove-theme`, and `data-theme="brutalist"` +
// localStorage `trove-aesthetic`.
export function AppearanceSettings() {
  const [aesthetic, setAesthetic] = useState<Aesthetic>("warm");
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const el = document.documentElement;
    setMode(el.classList.contains("dark") ? "dark" : "light");
    setAesthetic(el.getAttribute("data-theme") === "brutalist" ? "brutalist" : "warm");
  }, []);

  function applyAesthetic(a: Aesthetic) {
    setAesthetic(a);
    const el = document.documentElement;
    if (a === "brutalist") el.setAttribute("data-theme", "brutalist");
    else el.removeAttribute("data-theme");
    localStorage.setItem("trove-aesthetic", a);
  }

  function applyMode(m: Mode) {
    setMode(m);
    document.documentElement.classList.toggle("dark", m === "dark");
    localStorage.setItem("trove-theme", m);
  }

  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-semibold">Appearance</h2>

      <div>
        <p className="label">Theme</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AESTHETICS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => applyAesthetic(a.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                aesthetic === a.id
                  ? "border-brand-500 ring-2 ring-brand-500/40"
                  : "hover:bg-surface-2",
              )}
            >
              <div className="flex shrink-0 overflow-hidden rounded-lg border">
                {a.swatches.map((c, i) => (
                  <span key={i} style={{ background: c }} className="h-9 w-4" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-text-muted">{a.desc}</p>
              </div>
              {aesthetic === a.id && (
                <Check className="ml-auto h-4 w-4 shrink-0 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Mode</p>
        <div className="inline-flex rounded-xl bg-surface-2 p-1">
          {(["light", "dark"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyMode(m)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                mode === m ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text",
              )}
            >
              {m === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {m}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
