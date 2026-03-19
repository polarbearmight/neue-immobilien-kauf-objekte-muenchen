"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Map, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="grid grid-cols-4 rounded-[1.75rem] border border-border/80 bg-card/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(10,12,16,0.92)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
