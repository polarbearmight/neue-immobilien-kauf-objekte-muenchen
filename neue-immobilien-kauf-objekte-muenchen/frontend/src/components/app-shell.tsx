"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bookmark,
  Building2,
  Flame,
  Heart,
  Home,
  LogOut,
  Map,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UserCircle2,
} from "lucide-react";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { cn } from "@/lib/utils";

const nav = [
  ["Dashboard", "/dashboard", Home],
  ["Deal Radar", "/deals", Sparkles],
  ["Watchlist", "/watchlist", Heart],
  ["Brand New", "/brand-new", Flame],
  ["Price Drops", "/price-drops", Bookmark],
  ["Clusters", "/clusters", Building2],
  ["Districts", "/districts", Map],
  ["Geo Heatmap", "/geo", BarChart3],
  ["Settings", "/settings", Settings],
  ["Account", "/account", UserCircle2],
] as const;

const publicPaths = new Set(["/", "/contact", "/impressum", "/privacy", "/forgot-password", "/reset-password"]);
const THEME_KEY = "munich-dealfinder-theme";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(THEME_KEY) : null;
    const nextDark = stored === "dark";
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  const activeItem = useMemo(() => nav.find(([, href]) => pathname === href), [pathname]);

  if (publicPaths.has(pathname)) return <>{children}</>;

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background),color-mix(in_oklab,var(--background)_92%,var(--muted)))] text-foreground">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col md:flex-row md:gap-6 md:px-4 lg:px-6">
        <aside className="sticky top-0 hidden h-screen w-[290px] shrink-0 md:block">
          <div className="flex h-full flex-col gap-5 px-2 py-6">
            <div className="rounded-[2rem] border border-border/80 bg-sidebar/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[rgba(12,14,19,0.88)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Munich Deal Engine</div>
                  <div className="mt-2 text-xl font-semibold">Workspace</div>
                  <p className="mt-2 text-sm text-muted-foreground">Licht als Standard. Premium-Dark nur bei aktivem Dark Mode.</p>
                </div>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80" onClick={toggleTheme} aria-label="Theme wechseln">
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>

              <nav className="mt-5 space-y-1.5">
                {nav.map(([label, href, Icon]) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-[2rem] border border-border/80 bg-card/94 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[rgba(12,14,19,0.84)]">
              <div className="flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4 text-amber-500" /> Watchlist & Filter</div>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <Link href="/watchlist" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent">★ Watchlist direkt öffnen</Link>
                <Link href="/dashboard" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent">Gespeicherte Filter im Dashboard</Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-3 pb-28 md:px-0 md:py-6 md:pb-8">
          <div className="mb-4 rounded-[1.75rem] border border-border/80 bg-card/95 px-4 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-[rgba(10,12,16,0.92)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">DealFinder</p>
                <p className="truncate text-base font-semibold">{activeItem?.[0] || "Workspace"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80" onClick={toggleTheme} aria-label="Theme wechseln">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
                <Link href="/account" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80" aria-label="Account öffnen"><UserCircle2 className="h-4 w-4" /></Link>
                <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm md:inline-flex" onClick={() => location.reload()}>Refresh</button>
                <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm md:inline-flex" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logout…" : "Logout"}</button>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 md:hidden" onClick={logout} disabled={loggingOut} aria-label="Logout"><LogOut className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
