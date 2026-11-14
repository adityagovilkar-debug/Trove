"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Rows3,
  House,
  Plus,
  PlusCircle,
  Settings,
  LogOut,
  Command,
  ShoppingCart,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { TroveMark } from "./TroveMark";
import { CheckHaveSearch } from "./CheckHaveSearch";
import { CommandPalette } from "./CommandPalette";
import { SyncStatus } from "./SyncStatus";

// Four screens (rework phase 2): Home finds, Stuff lists, Places maps the
// house, Shopping restocks. Add sits in the middle of the phone bar.
const NAV = [
  { href: "/", label: "Home", icon: Search, exact: true },
  { href: "/stuff", label: "Stuff", icon: Rows3 },
  { href: "/places", label: "Places", icon: House },
  { href: "/shopping", label: "Shopping", short: "Shop", icon: ShoppingCart },
];

export function AppShell({
  email,
  name,
  children,
}: {
  email: string;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === "/";

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href) && href !== "/";
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const tab = (n: (typeof NAV)[number]) => {
    const on = isActive(n.href, n.exact);
    const Icon = n.icon;
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] uppercase tracking-[0.08em] transition-colors",
          on ? "font-semibold text-ink" : "font-medium text-ink-3",
        )}
      >
        {on && <span className="absolute inset-x-[22%] top-0 h-0.5 bg-ink" />}
        <Icon className="h-5 w-5" strokeWidth={on ? 2 : 1.6} />
        {n.short ?? n.label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-surface p-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <TroveMark className="h-9 w-9 rounded-xl" />
          <span className="wordmark text-lg font-semibold tracking-tight">Trove</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const on = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                  on
                    ? "bg-surface-2 font-semibold text-ink"
                    : "font-medium text-ink-3 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {on && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-ink" />}
                <Icon className="h-[18px] w-[18px]" strokeWidth={on ? 2 : 1.6} />
                {label}
              </Link>
            );
          })}
          <Link href="/add" className="btn-primary mt-4 justify-center">
            <PlusCircle className="h-[18px] w-[18px]" />
            Add
          </Link>
        </nav>

        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-text-muted">{email}</p>
            </div>
            <ThemeToggle />
          </div>
          <Link
            href="/settings"
            className={cn(
              "flex w-full items-center gap-3 rounded px-3 py-2 text-sm font-medium hover:bg-surface-2 hover:text-text",
              isActive("/settings") ? "text-ink" : "text-text-muted",
            )}
          >
            <Settings className="h-[18px] w-[18px]" />
            Settings
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-bg/80 px-4 py-2.5 backdrop-blur md:gap-3 md:px-8 md:py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 md:hidden" aria-label="Home">
            <TroveMark className="h-8 w-8 rounded-lg" />
            {onHome && <span className="font-mono text-xs font-semibold tracking-[0.32em]">TROVE</span>}
          </Link>
          {/* Home has its own big search box; everywhere else the header has one. */}
          <div className="min-w-0 flex-1">{!onHome && <CheckHaveSearch />}</div>
          <SyncStatus />
          <button
            onClick={() => window.dispatchEvent(new Event("trove:command"))}
            className="btn-ghost hidden shrink-0 px-2 py-2 md:inline-flex"
            title="Command palette (⌘K)"
            aria-label="Open command palette"
          >
            <Command className="h-[18px] w-[18px]" />
            <kbd className="hidden text-[11px] text-text-muted lg:inline">⌘K</kbd>
          </button>
          <div className="flex shrink-0 items-center md:hidden">
            <ThemeToggle />
            <Link
              href="/settings"
              className="btn-ghost px-2 py-2"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>

      {/* Phone bar: Home · Stuff · [Add] · Places · Shop — always pinned */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex h-16 items-stretch">
          {tab(NAV[0])}
          {tab(NAV[1])}
          <Link
            href="/add"
            aria-label="Add something"
            className="flex flex-1 items-center justify-center"
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[3px] bg-ink text-paper",
                isActive("/add") && "outline outline-2 outline-offset-2 outline-ink",
              )}
            >
              <Plus className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </Link>
          {tab(NAV[2])}
          {tab(NAV[3])}
        </div>
      </nav>

      <CommandPalette />
    </div>
  );
}
