"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          <div className="mb-4 rounded-2xl border px-4 py-4 text-sm shadow-sm md:px-3 md:py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button className="min-h-11 rounded-xl border px-4 py-2 text-sm font-medium md:hidden" onClick={() => setMobileNavOpen((v) => !v)}>{mobileNavOpen ? "Menü schließen" : "Menü öffnen"}</button>
                <input placeholder="Search (page-local)" className="min-h-11 w-full rounded-xl border px-3 py-2 text-sm md:max-w-xs" disabled />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button className="min-h-11 rounded-xl border px-4 py-2 text-sm" onClick={() => location.reload()}>Refresh</button>
                <button className="min-h-11 rounded-xl border px-4 py-2 text-sm" onClick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
                <button className="col-span-2 min-h-11 rounded-xl border px-4 py-2 text-sm sm:col-span-1" onClick={logout} disabled={loggingOut}>{loggingOut ? "Logout…" : "Logout"}</button>
              </div>
            </div>
            {mobileNavOpen ? <div className="mt-4 grid gap-2 border-t pt-4 md:hidden">{nav.map(([label, href]) => <Link key={href} href={href} className={`rounded-xl px-4 py-3 text-sm ${pathname === href ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`} onClick={() => setMobileNavOpen(false)}>{label}</Link>)}</div> : null}
          </div>
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
