"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  ["Home", "/dashboard"],
  ["Deals", "/deals"],
  ["Watchlist", "/watchlist"],
  ["Map", "/map"],
  ["Account", "/account"],
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <div className="grid grid-cols-5 rounded-[1.75rem] border border-white/70 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        {tabs.map(([label, href]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex min-h-12 items-center justify-center rounded-2xl text-xs font-medium ${active ? "bg-slate-950 text-white" : "text-slate-500"}`}>
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
