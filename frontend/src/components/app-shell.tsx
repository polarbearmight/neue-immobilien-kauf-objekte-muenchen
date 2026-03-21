"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
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
  MapPinned,
  Moon,
  Radar,
  Settings,
  Sparkles,
  Sun,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RoleKey = "free" | "pro" | "admin";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: "core" | "signals" | "market" | "account";
  mobileQuick?: boolean;
  minRole?: RoleKey;
};

const nav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, section: "core", mobileQuick: true, minRole: "free" },
  { label: "Deal Radar", href: "/deals", icon: Sparkles, section: "core", mobileQuick: true, minRole: "free" },
  { label: "Map", href: "/map", icon: MapPinned, section: "core", mobileQuick: true, minRole: "free" },
  { label: "Watchlist", href: "/watchlist", icon: Heart, section: "core", mobileQuick: true, minRole: "free" },
  { label: "Brand New", href: "/brand-new", icon: Flame, section: "signals", mobileQuick: true, minRole: "free" },
  { label: "Price Drops", href: "/price-drops", icon: Bookmark, section: "signals", mobileQuick: true, minRole: "free" },
  { label: "Off Market", href: "/off-market", icon: Radar, section: "signals", mobileQuick: true, minRole: "pro" },
  { label: "Clusters", href: "/clusters", icon: Building2, section: "market", mobileQuick: true, minRole: "free" },
  { label: "Districts", href: "/districts", icon: Map, section: "market", minRole: "free" },
  { label: "Geo Heatmap", href: "/geo", icon: BarChart3, section: "market", minRole: "pro" },
  { label: "Sources", href: "/sources", icon: BarChart3, section: "market", minRole: "admin" },
  { label: "Settings", href: "/settings", icon: Settings, section: "account", minRole: "free" },
  { label: "Account", href: "/account", icon: UserCircle2, section: "account", minRole: "free" },
];

const navSections: Array<{ key: NavItem["section"]; label: string }> = [
  { key: "core", label: "Core" },
  { key: "signals", label: "Signals" },
  { key: "market", label: "Market Intel" },
  { key: "account", label: "Workspace" },
];

const mobileQuickLinks = nav.filter((item) => item.mobileQuick);
const roleRank: Record<RoleKey, number> = { free: 0, pro: 1, admin: 2 };
const publicPaths = new Set(["/", "/contact", "/impressum", "/privacy", "/forgot-password", "/reset-password"]);
const THEME_KEY = "munich-dealfinder-theme";

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [roleInfo, setRoleInfo] = useState<{ role?: string; effective_role?: string; license_until?: string | null } | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(THEME_KEY) : null;
    const nextDark = stored === "dark";
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setRoleInfo(json?.user || null))
      .catch(() => setRoleInfo(null));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  const effectiveRoleKey = ((roleInfo?.effective_role || roleInfo?.role || "free").toLowerCase() as RoleKey);
  const effectiveRole = effectiveRoleKey.toUpperCase();
  const visibleNav = useMemo(() => nav.filter((item) => roleRank[effectiveRoleKey] >= roleRank[item.minRole || "free"]), [effectiveRoleKey]);
  const mobileQuickLinks = useMemo(() => visibleNav.filter((item) => item.mobileQuick), [visibleNav]);
  const activeItem = useMemo(() => visibleNav.find((item) => isActivePath(pathname, item.href)) || nav.find((item) => isActivePath(pathname, item.href)), [pathname, visibleNav]);

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
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background),color-mix(in_oklab,var(--background)_92%,var(--muted)))] text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(245,197,66,0.08),rgba(15,17,23,1)_30%,rgba(10,12,16,1)_100%)]">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col md:flex-row md:gap-6 md:px-4 lg:px-6">
        <aside className="sticky top-0 hidden h-screen w-[304px] shrink-0 md:block">
          <div className="flex h-full flex-col gap-5 px-2 py-6">
            <div className="flex h-full flex-col gap-5 rounded-[2rem] border border-border/80 bg-sidebar/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-amber-400/14 dark:bg-[linear-gradient(180deg,rgba(29,24,15,0.96),rgba(12,14,19,0.94))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground dark:text-amber-100/70">Munich Deal Engine</div>
                  <div className="mt-2 text-xl font-semibold">Workspace</div>
                  <div className="mt-3">
                    <span className={cn(
                      "inline-flex min-h-10 items-center rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em]",
                      effectiveRole === "ADMIN"
                        ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
                        : effectiveRole === "PRO"
                          ? "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
                          : "border-border bg-background/80 text-muted-foreground dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-100"
                    )}>{effectiveRole}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Mehr Orientierung im Sidebar-Flow, Light als Standard und Dark weiter mit Goldakzenten.</p>
                </div>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50" onClick={toggleTheme} aria-label="Theme wechseln">
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>

              <nav className="mt-1 space-y-4 overflow-y-auto pr-1">
                {navSections.map((section) => {
                  const items = visibleNav.filter((item) => item.section === section.key);
                  return (
                    <div key={section.key} className="space-y-1.5">
                      <div className="px-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 dark:text-amber-100/55">{section.label}</div>
                      {items.map(({ label, href, icon: Icon }) => {
                        const active = isActivePath(pathname, href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition",
                              active
                                ? "border-primary/15 bg-primary text-primary-foreground shadow-sm dark:border-amber-300/35 dark:bg-amber-300 dark:text-[#1a1408]"
                                : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-accent-foreground dark:hover:border-amber-400/12 dark:hover:bg-amber-300/10 dark:hover:text-amber-50"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="font-medium">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-[1.8rem] border border-border/80 bg-card/94 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-amber-400/14 dark:bg-[rgba(11,13,18,0.88)]">
                <div className="flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4 text-amber-500" /> Watchlist & Workflow</div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                  <Link href="/watchlist" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-amber-400/12 dark:bg-white/[0.03] dark:hover:bg-amber-300/10">★ Watchlist direkt öffnen</Link>
                  <Link href="/dashboard" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-amber-400/12 dark:bg-white/[0.03] dark:hover:bg-amber-300/10">Gespeicherte Filter im Dashboard</Link>
                  <Link href="/sources" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-amber-400/12 dark:bg-white/[0.03] dark:hover:bg-amber-300/10">Quellenlage & Health prüfen</Link>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-3 pb-28 md:px-0 md:py-6 md:pb-8">
          <div className="sticky top-0 z-40 -mx-3 mb-4 border-b border-border/70 bg-background/82 px-3 pb-2 pt-3 backdrop-blur-xl dark:border-amber-400/10 dark:bg-[rgba(10,12,16,0.84)] md:static md:mx-0 md:mb-4 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-0">
            <div className="rounded-[1.75rem] border border-border/80 bg-card/95 px-4 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(31,25,15,0.94),rgba(10,12,16,0.94))] dark:shadow-[0_18px_60px_rgba(0,0,0,0.26)] md:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground dark:text-amber-100/70">DealFinder</p>
                  <p className="truncate text-base font-semibold md:text-lg">{activeItem?.label || "Workspace"}</p>
                  <p className="mt-1 hidden text-xs text-muted-foreground md:block">{activeItem ? `Aktiv: ${activeItem.label}` : "Alle Marktansichten bleiben direkt erreichbar."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex min-h-11 items-center rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em]",
                    effectiveRole === "ADMIN"
                      ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
                      : effectiveRole === "PRO"
                        ? "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
                        : "border-border bg-background/80 text-muted-foreground dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-100"
                  )}>{effectiveRole}</span>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50" onClick={toggleTheme} aria-label="Theme wechseln">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
                  <Link href="/account" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50" aria-label="Account öffnen"><UserCircle2 className="h-4 w-4" /></Link>
                  <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50 md:inline-flex" onClick={() => location.reload()}>Refresh</button>
                  <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50 md:inline-flex" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logout…" : "Logout"}</button>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50 md:hidden" onClick={logout} disabled={loggingOut} aria-label="Logout"><LogOut className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {mobileQuickLinks.map(({ label, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground dark:border-amber-300/50 dark:bg-amber-300 dark:text-[#1a1408]"
                        : "border-border bg-card/90 text-muted-foreground dark:border-amber-400/12 dark:bg-white/[0.03] dark:text-amber-100/78"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
