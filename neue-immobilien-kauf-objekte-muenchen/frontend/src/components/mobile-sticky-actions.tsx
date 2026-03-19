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
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[1.6rem] border border-white/12 bg-[rgba(10,12,16,0.92)] px-3 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/12 px-4 py-2 text-sm font-medium text-white" onClick={onOpenFilters}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <div className="text-center text-sm text-white/62">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">Treffer</div>
          <div className="font-semibold text-white">{resultCount}</div>
        </div>
        <button className="min-h-11 rounded-2xl bg-[#d2b77a] px-4 py-2 text-sm font-medium text-[#17181c]" onClick={onRefresh}>Refresh</button>
      </div>
    </div>
  );
}
