"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, Bookmark, Building2, Heart, Home, Map, MapPinned, Search, Settings, Sparkles, UserCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryTabs = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Deals", href: "/deals", icon: Search },
  { label: "Map", href: "/map", icon: MapPinned },
  { label: "Watchlist", href: "/watchlist", icon: Heart },
] as const;

const quickLinks = [
  { label: "Brand New", href: "/brand-new", icon: Sparkles },
  { label: "Price Drops", href: "/price-drops", icon: Bookmark },
  { label: "Clusters", href: "/clusters", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

const moreLinks = [
  { label: "Off Market", href: "/off-market", icon: Sparkles },
  { label: "Districts", href: "/districts", icon: Map },
  { label: "Geo Heatmap", href: "/geo", icon: BarChart3 },
  { label: "Sources", href: "/sources", icon: BarChart3 },
  { label: "Account", href: "/account", icon: UserCircle2 },
] as const;

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasActiveMoreLink = useMemo(() => moreLinks.some((link) => isActivePath(pathname, link.href)), [pathname]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm dark:bg-black/55" aria-label="Mehr Navigation schließen" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-3 bottom-28 rounded-[2rem] border border-border/80 bg-card/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-amber-400/15 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.96),rgba(10,12,16,0.98))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground dark:text-amber-100/70">More Navigation</div>
                <div className="mt-1 text-base font-semibold">Alle Marktansichten schnell erreichbar</div>
              </div>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/80 dark:border-amber-400/15 dark:bg-amber-300/10 dark:text-amber-50" onClick={() => setMoreOpen(false)} aria-label="Schließen">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map(({ label, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-[68px] items-center gap-3 rounded-[1.3rem] border px-3 py-3 text-sm font-medium transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground dark:border-amber-300/55 dark:bg-amber-300 dark:text-[#1a1408]"
                        : "border-border/70 bg-background/75 text-muted-foreground dark:border-amber-400/12 dark:bg-white/[0.03] dark:text-amber-100/78"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.94),rgba(10,12,16,0.98))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground dark:text-amber-100/70">
            <span>Mobile Workspace</span>
            <button className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", hasActiveMoreLink ? "bg-primary text-primary-foreground dark:bg-amber-300 dark:text-[#1a1408]" : "bg-muted text-muted-foreground dark:bg-white/10 dark:text-amber-100/70")} onClick={() => setMoreOpen((prev) => !prev)}>
              Mehr
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {primaryTabs.map(({ label, href, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[1.2rem] px-2 text-[11px] font-medium transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm dark:bg-amber-300 dark:text-[#1a1408]"
                      : "border border-transparent text-muted-foreground dark:text-amber-50/88"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2">
            {quickLinks.map(({ label, href, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[1.1rem] border px-2 text-[10px] font-medium transition",
                    active
                      ? "border-amber-300/60 bg-amber-300/18 text-foreground dark:border-amber-300/45 dark:bg-amber-300/14 dark:text-amber-50"
                      : "border-border/70 bg-background/75 text-muted-foreground dark:border-amber-400/12 dark:bg-white/[0.03] dark:text-amber-100/70"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
