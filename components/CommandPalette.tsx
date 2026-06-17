"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  CalendarClock,
  Boxes,
  ShoppingCart,
  PlusCircle,
  CreditCard,
  LineChart,
  Settings,
  SunMoon,
  LogOut,
  MapPin,
  CornerDownLeft,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useStockSearch } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Boxes;
  run: () => void;
}

// Global ⌘K / Ctrl+K palette: "do I have it?" search + jump anywhere.
// Also opens on a window "trove:command" event (fired by the header button).
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("trove:command", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("trove:command", onEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  function close() {
    setOpen(false);
  }
  function go(href: string) {
    router.push(href);
    close();
  }
  function toggleTheme() {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("trove-theme", dark ? "dark" : "light");
    close();
  }
  async function signOut() {
    await supabaseBrowser().auth.signOut();
    close();
    router.replace("/login");
    router.refresh();
  }

  const actions: Action[] = useMemo(
    () => [
      { id: "dash", label: "Dashboard", icon: LayoutDashboard, run: () => go("/") },
      { id: "up", label: "Upcoming", icon: CalendarClock, run: () => go("/upcoming") },
      { id: "inv", label: "Inventory", icon: Boxes, run: () => go("/inventory") },
      { id: "shop", label: "Shopping list", icon: ShoppingCart, run: () => go("/shopping") },
      { id: "add", label: "Add stock", icon: PlusCircle, run: () => go("/add") },
      { id: "subs", label: "Subscriptions", icon: CreditCard, run: () => go("/subscriptions") },
      { id: "trends", label: "Trends", icon: LineChart, run: () => go("/trends") },
      { id: "settings", label: "Settings", icon: Settings, run: () => go("/settings") },
      { id: "theme", label: "Toggle light / dark", icon: SunMoon, run: toggleTheme },
      { id: "out", label: "Sign out", icon: LogOut, run: signOut },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const q = query.trim().toLowerCase();
  const filteredActions = q
    ? actions.filter((a) => a.label.toLowerCase().includes(q))
    : actions;
  const { data: stock = [] } = useStockSearch(query);

  // Flattened, navigable list.
  const items = useMemo(
    () => [
      ...filteredActions.map((a) => ({ type: "action" as const, action: a })),
      ...stock.map((s) => ({ type: "stock" as const, stock: s })),
    ],
    [filteredActions, stock],
  );

  useEffect(() => setSel(0), [query]);

  function run(i: number) {
    const it = items[i];
    if (!it) return;
    if (it.type === "action") it.action.run();
    else go("/inventory");
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(sel);
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  let idx = -1;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onMouseDown={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-[18px] w-[18px] text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search your home or jump to…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] text-text-muted sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">No matches.</p>
          )}

          {filteredActions.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              Actions
            </p>
          )}
          {filteredActions.map((a) => {
            idx++;
            const active = idx === sel;
            const i = idx;
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  active ? "bg-brand-600 text-white" : "hover:bg-surface-2",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{a.label}</span>
                {active && <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />}
              </button>
            );
          })}

          {stock.length > 0 && (
            <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              In stock
            </p>
          )}
          {stock.map((s) => {
            idx++;
            const active = idx === sel;
            const i = idx;
            return (
              <button
                key={s.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => run(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  active ? "bg-brand-600 text-white" : "hover:bg-surface-2",
                )}
              >
                <Boxes className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">
                  {s.item_name}
                  <span className={cn("ml-2 text-xs", active ? "text-white/70" : "text-text-muted")}>
                    {s.quantity}
                    {s.unit ? ` ${s.unit}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    active ? "text-white/70" : "text-text-muted",
                  )}
                >
                  <MapPin className="h-3 w-3" />
                  {s.location_name ?? "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
