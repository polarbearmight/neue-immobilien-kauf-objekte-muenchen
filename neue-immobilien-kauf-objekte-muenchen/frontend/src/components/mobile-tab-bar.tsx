"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Map, Search } from "lucide-react";

const tabs = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Deals", href: "/deals", icon: Search },
  { label: "Map", href: "/map", icon: Map },
  { label: "Watchlist", href: "/watchlist", icon: Heart },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <div className="grid grid-cols-4 rounded-[1.75rem] border border-white/12 bg-[rgba(10,12,16,0.92)] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition ${active ? "bg-[#d2b77a] text-[#17181c]" : "text-white/58"}`}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
