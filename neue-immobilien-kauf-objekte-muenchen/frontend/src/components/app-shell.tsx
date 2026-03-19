"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import { MobileTabBar } from "@/components/mobile-tab-bar";

const nav = [
  ["Dashboard", "/dashboard"],
  ["Deal Radar", "/deals"],
  ["Watchlist", "/watchlist"],
  ["Brand New", "/brand-new"],
  ["Price Drops", "/price-drops"],
  ["Clusters", "/clusters"],
  ["Off-Market", "/off-market"],
  ["Districts", "/districts"],
  ["Geo Heatmap", "/geo"],
  ["Map", "/map"],
  ["Sources", "/sources"],
  ["Settings", "/settings"],
  ["Account", "/account"],
  ["District Debug", "/district-debug"],
  ["Source Debug", "/source-debug"],
  ["Duplicate Debug", "/duplicate-debug"],
  ["Geo Debug", "/geo-debug"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  const [loggingOut, setLoggingOut] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const publicPaths = new Set(["/", "/contact", "/impressum", "/privacy", "/forgot-password", "/reset-password"]);
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col md:flex-row">
        <aside className="hidden w-56 border-r p-4 md:block">
          <p className="mb-4 text-sm font-semibold">Munich Deal Engine</p>
          <nav className="space-y-1">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className={`block rounded-lg px-3 py-2 text-sm ${pathname === href ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 px-3 py-3 pb-28 md:px-6 md:py-6 md:pb-6">
          <div className="mb-4 rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.92)] px-4 py-4 text-sm text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)] md:bg-background md:text-foreground md:shadow-sm md:px-3 md:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-white/35 md:text-muted-foreground">DealFinder</p>
                <p className="truncate text-base font-semibold md:text-sm">{nav.find(([, href]) => pathname === href)?.[0] || 'Workspace'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 md:border px-0" onClick={toggleTheme} aria-label="Theme wechseln">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
                <Link href="/account" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 md:border" aria-label="Account öffnen"><UserCircle2 className="h-4 w-4" /></Link>
                <button className="hidden min-h-11 rounded-xl border px-4 py-2 text-sm md:inline-flex" onClick={() => location.reload()}>Refresh</button>
                <button className="hidden min-h-11 rounded-xl border px-4 py-2 text-sm md:inline-flex" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logout…" : "Logout"}</button>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 md:hidden" onClick={logout} disabled={loggingOut} aria-label="Logout"><LogOut className="h-4 w-4" /></button>
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
