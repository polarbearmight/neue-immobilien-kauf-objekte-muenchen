"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

const nav = [
  ["Dashboard", "/"],
  ["Deal Radar", "/deals"],
  ["Brand New", "/brand-new"],
  ["Price Drops", "/price-drops"],
  ["Clusters", "/clusters"],
  ["Off-Market", "/off-market"],
  ["Districts", "/districts"],
  ["District Debug", "/district-debug"],
  ["Source Debug", "/source-debug"],
  ["Duplicate Debug", "/duplicate-debug"],
  ["Geo Debug", "/geo-debug"],
  ["Geo Heatmap", "/geo"],
  ["Map", "/map"],
  ["Sources", "/sources"],
  ["Watchlist", "/watchlist"],
  ["Settings", "/settings"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
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
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          <div className="mb-4 flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
            <input placeholder="Search (page-local)" className="w-full max-w-xs rounded border px-2 py-1 text-xs" disabled />
            <button className="rounded border px-2 py-1 text-xs" onClick={() => location.reload()}>Refresh</button>
            <button className="rounded border px-2 py-1 text-xs" onClick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
