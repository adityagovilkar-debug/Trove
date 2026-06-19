"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  PlusCircle,
  LineChart,
  Settings,
  LogOut,
  CreditCard,
  CalendarClock,
  Command,
  ShoppingCart,
  ChefHat,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { CheckHaveSearch } from "./CheckHaveSearch";
import { CommandPalette } from "./CommandPalette";
import { SyncStatus } from "./SyncStatus";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true, mobile: true },
  { href: "/upcoming", label: "Upcoming", short: "Soon", icon: CalendarClock, mobile: true },
  { href: "/inventory", label: "Inventory", short: "Stock", icon: Boxes, mobile: true },
  { href: "/recipes", label: "Recipes", short: "Cook", icon: ChefHat, mobile: true },
  { href: "/shopping", label: "Shopping", short: "List", icon: ShoppingCart, mobile: true },
  { href: "/subscriptions", label: "Subscriptions", short: "Subs", icon: CreditCard, mobile: false },
  { href: "/add", label: "Add Stock", short: "Add", icon: PlusCircle, mobile: false },
  { href: "/trends", label: "Trends", short: "Trends", icon: LineChart, mobile: false },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, mobile: false },
];

// Mobile bottom bar shows the 5 most-used; the rest are reachable via the
// sidebar (desktop) and the ⌘K command palette.
const MOBILE_NAV = NAV.filter((n) => n.mobile);

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

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href) && href !== "/";
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-semibold tracking-tight">Trove</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(href, exact)
                  ? "bg-brand-600 text-white"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-text-muted">{email}</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar with the killer "do I have it?" search */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-bg/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
          </div>
          <div className="flex-1">
            <CheckHaveSearch />
          </div>
          <SyncStatus />
          <button
            onClick={() => window.dispatchEvent(new Event("trove:command"))}
            className="btn-ghost shrink-0 px-2 py-2"
            title="Command palette (⌘K)"
            aria-label="Open command palette"
          >
            <Command className="h-[18px] w-[18px]" />
            <kbd className="hidden text-[11px] text-text-muted lg:inline">⌘K</kbd>
          </button>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-surface md:hidden">
        {MOBILE_NAV.map(({ href, short, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
              isActive(href, exact) ? "text-brand-600" : "text-text-muted",
            )}
          >
            {isActive(href, exact) && (
              <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-600" />
            )}
            <Icon className="h-5 w-5" />
            {short}
          </Link>
        ))}
      </nav>

      <CommandPalette />
    </div>
  );
}
