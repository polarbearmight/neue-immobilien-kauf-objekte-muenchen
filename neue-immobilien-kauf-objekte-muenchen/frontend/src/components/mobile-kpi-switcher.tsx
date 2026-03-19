"use client";

import { cn } from "@/lib/utils";

export function MobileKpiSwitcher({
  active,
  setActive,
}: {
  active: "market" | "deals" | "sources";
  setActive: (value: "market" | "deals" | "sources") => void;
}) {
  const tabs: Array<[
    "market" | "deals" | "sources",
    string,
    string,
  ]> = [
    ["market", "Market", "Makro & Nachfrage"],
    ["deals", "Deals", "Score & Treffer"],
    ["sources", "Sources", "Quellen & Health"],
  ];

  return (
    <div className="rounded-[1.6rem] border border-border/80 bg-card/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-amber-400/18 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.94),rgba(10,12,16,0.98))] dark:shadow-[0_20px_60px_rgba(0,0,0,0.34)] md:hidden">
      <div className="mb-1 flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground dark:text-amber-100/68">
        <span>Mobile focus</span>
        <span>Dark / Gold</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {tabs.map(([key, label, hint]) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              className={cn(
                "flex min-h-[72px] flex-col justify-center rounded-[1.15rem] border px-3 py-3 text-left transition duration-200",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm dark:border-amber-300/50 dark:bg-amber-300 dark:text-[#1a1408]"
                  : "border-border/70 bg-background/80 text-muted-foreground dark:border-amber-400/14 dark:bg-white/[0.04] dark:text-amber-100/76"
              )}
              onClick={() => setActive(key)}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span
                className={cn(
                  "mt-1 text-[11px] leading-snug",
                  isActive ? "text-current/75" : "text-muted-foreground dark:text-amber-100/56"
                )}
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
