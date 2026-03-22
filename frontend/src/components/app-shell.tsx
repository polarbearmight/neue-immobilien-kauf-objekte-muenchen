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
import { getEffectiveRole, getRolePermissions, hasMinRole, type RoleKey, type RoleInfo } from "@/lib/roles";
import { cn } from "@/lib/utils";

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

const publicPaths = new Set(["/", "/contact", "/impressum", "/privacy", "/forgot-password", "/reset-password"]);
const THEME_KEY = "munich-dealfinder-theme";
const ROLE_CACHE_KEY = "munich-dealfinder-role-cache";
const ROLE_UPDATED_EVENT = "mdf-role-updated";

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AppShell({ children, initialRoleInfo }: { children: ReactNode; initialRoleInfo?: RoleInfo | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem(ROLE_CACHE_KEY);
        if (cached) return JSON.parse(cached) as RoleInfo;
      } catch {}
    }
    return initialRoleInfo ?? null;
  });

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(THEME_KEY) : null;
    const nextDark = stored === "dark";
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
  }, []);

  useEffect(() => {
    const onRoleUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setRoleInfo(detail || null);
      if (typeof window !== "undefined") {
        if (detail) window.localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(detail));
        else window.localStorage.removeItem(ROLE_CACHE_KEY);
      }
    };
    window.addEventListener(ROLE_UPDATED_EVENT, onRoleUpdated as EventListener);

    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem(ROLE_CACHE_KEY);
        if (cached) setRoleInfo(JSON.parse(cached) as RoleInfo);
      } catch {}
    }

    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const nextUser = json?.user || null;
        setRoleInfo(nextUser);
        if (typeof window !== "undefined") {
          if (nextUser) window.localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(nextUser));
          else window.localStorage.removeItem(ROLE_CACHE_KEY);
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          try {
            const cached = window.localStorage.getItem(ROLE_CACHE_KEY);
            setRoleInfo(cached ? (JSON.parse(cached) as RoleInfo) : (initialRoleInfo ?? null));
            return;
          } catch {}
        }
        setRoleInfo(initialRoleInfo ?? null);
      });

    return () => window.removeEventListener(ROLE_UPDATED_EVENT, onRoleUpdated as EventListener);
  }, [initialRoleInfo]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };

  const permissions = useMemo(() => getRolePermissions(roleInfo), [roleInfo]);
  const effectiveRoleKey = getEffectiveRole(roleInfo);
  const effectiveRole = effectiveRoleKey.toUpperCase();
  const visibleNav = useMemo(() => nav.filter((item) => hasMinRole(permissions.role, item.minRole || "free")), [permissions.role]);
  const mobileQuickLinks = useMemo(() => visibleNav.filter((item) => item.mobileQuick), [visibleNav]);
  const activeItem = useMemo(() => visibleNav.find((item) => isActivePath(pathname, item.href)) || nav.find((item) => isActivePath(pathname, item.href)), [pathname, visibleNav]);

  if (publicPaths.has(pathname)) return <>{children}</>;

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ROLE_CACHE_KEY);
        window.dispatchEvent(new CustomEvent(ROLE_UPDATED_EVENT, { detail: null }));
      }
    } finally {
      router.push("/");
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background),color-mix(in_oklab,var(--background)_92%,var(--muted)))] text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(245,197,66,0.08),rgba(15,17,23,1)_30%,rgba(10,12,16,1)_100%)]">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col md:flex-row md:gap-6 md:px-4 lg:px-6">
        <aside className="sticky top-0 hidden h-screen w-[304px] shrink-0 md:block lg:w-[320px]">
          <div className="flex h-full flex-col px-2 py-5 lg:py-6">
            <div className="flex h-[calc(100vh-2.5rem)] min-h-0 flex-col gap-4 rounded-[2rem] border border-border/80 bg-sidebar/92 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur lg:gap-5 lg:p-5 dark:border-amber-400/14 dark:bg-[linear-gradient(180deg,rgba(29,24,15,0.96),rgba(12,14,19,0.94))] dark:shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
              <div className="flex items-start justify-between gap-3 rounded-[1.6rem] border border-border/60 bg-background/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground dark:text-zinc-400">Munich Deal Engine</div>
                  <div className="mt-2 text-xl font-semibold">Workspace</div>
                  <div className="mt-3">
                    <span className={cn(
                      "inline-flex min-h-10 items-center rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em]",
                      effectiveRole === "ADMIN"
                        ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-400/35 dark:bg-rose-400/12 dark:text-rose-100"
                        : effectiveRole === "PRO"
                          ? "border-sky-300/70 bg-sky-500/10 text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-100"
                          : "border-border bg-background/80 text-muted-foreground dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-200"
                    )}>{effectiveRole}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">Mehr Orientierung im Sidebar-Flow, Light als Standard und Dark weiter mit Goldakzenten.</p>
                </div>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100" onClick={toggleTheme} aria-label="Theme wechseln">
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>

              <nav className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-1.5">
                {navSections.map((section) => {
                  const items = visibleNav.filter((item) => item.section === section.key);
                  return (
                    <div key={section.key} className="space-y-1.5">
                      <div className="px-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 dark:text-zinc-500">{section.label}</div>
                      {items.map(({ label, href, icon: Icon }) => {
                        const active = isActivePath(pathname, href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={cn(
                              "group flex min-h-11 items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition",
                              active
                                ? "border-primary/15 bg-primary text-primary-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-white"
                                : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-accent-foreground dark:text-zinc-300 dark:hover:border-white/10 dark:hover:bg-white/[0.05] dark:hover:text-white"
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

              <div className="mt-auto rounded-[1.8rem] border border-border/80 bg-card/94 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-5 dark:border-white/10 dark:bg-[rgba(11,13,18,0.88)]">
                <div className="flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4 text-amber-500" /> Watchlist & Workflow</div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground dark:text-zinc-300">
                  <Link href="/watchlist" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">★ Watchlist direkt öffnen</Link>
                  <Link href="/dashboard" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">Gespeicherte Filter im Dashboard</Link>
                  {permissions.canAccessSources ? <Link href="/sources" className="rounded-2xl border border-border/80 bg-background/70 px-3 py-3 hover:bg-accent dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">Quellenlage & Health prüfen</Link> : null}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 py-3 pb-28 md:px-0 md:py-6 md:pb-8">
          <div className="sticky top-0 z-40 -mx-3 mb-4 border-b border-border/70 bg-background/82 px-3 pb-2 pt-3 backdrop-blur-xl dark:border-amber-400/10 dark:bg-[rgba(10,12,16,0.84)] md:static md:mx-0 md:mb-4 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-0">
            <div className="rounded-[1.75rem] border border-border/80 bg-card/95 px-4 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(31,25,15,0.94),rgba(10,12,16,0.94))] dark:shadow-[0_18px_60px_rgba(0,0,0,0.26)] md:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground dark:text-zinc-400">DealFinder</p>
                  <p className="truncate text-base font-semibold md:text-lg">{activeItem?.label || "Workspace"}</p>
                  <p className="mt-1 hidden text-xs text-muted-foreground md:block">{activeItem ? `Aktiv: ${activeItem.label}` : "Alle Marktansichten bleiben direkt erreichbar."}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                  <span className={cn(
                    "inline-flex min-h-11 items-center rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em]",
                    effectiveRole === "ADMIN"
                      ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-400/35 dark:bg-rose-400/12 dark:text-rose-100"
                      : effectiveRole === "PRO"
                        ? "border-sky-300/70 bg-sky-500/10 text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-100"
                        : "border-border bg-background/80 text-muted-foreground dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-200"
                  )}>{effectiveRole}</span>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100" onClick={toggleTheme} aria-label="Theme wechseln">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
                  <Link href="/account" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100" aria-label="Account öffnen"><UserCircle2 className="h-4 w-4" /></Link>
                  <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100 md:inline-flex" onClick={() => location.reload()}>Refresh</button>
                  <button className="hidden min-h-11 rounded-2xl border border-border bg-background px-4 py-2 text-sm dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100 md:inline-flex" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logout…" : "Logout"}</button>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-100 md:hidden" onClick={logout} disabled={loggingOut} aria-label="Logout"><LogOut className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="mobile-chip-row mt-3 flex gap-2 overflow-x-auto pb-1 pr-1 md:hidden">
              {mobileQuickLinks.map(({ label, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium whitespace-nowrap transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground dark:border-white/10 dark:bg-white/[0.08] dark:text-white"
                        : "border-border bg-card/90 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
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
