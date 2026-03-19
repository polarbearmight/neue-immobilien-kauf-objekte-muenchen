"use client";

import { Filter } from "lucide-react";

export function MobileStickyActions({
  onOpenFilters,
  onRefresh,
  resultCount,
}: {
  onOpenFilters: () => void;
  onRefresh: () => void;
  resultCount: number;
}) {
  return (
    <div className="sticky bottom-20 z-40 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[1.6rem] border border-border/80 bg-card/95 px-3 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/12 dark:bg-[rgba(10,12,16,0.92)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium" onClick={onOpenFilters}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <div className="text-center text-sm text-muted-foreground">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">Treffer</div>
          <div className="font-semibold text-foreground">{resultCount}</div>
        </div>
        <button className="min-h-11 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={onRefresh}>Refresh</button>
      </div>
    </div>
  );
}
