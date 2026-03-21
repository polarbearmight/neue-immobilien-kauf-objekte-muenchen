"use client";

import { Filter, RotateCcw, SlidersHorizontal } from "lucide-react";

export function MobileStickyActions({
  onOpenFilters,
  onReset,
  onApply,
  resultCount,
  activeFilterCount,
  hasPendingChanges,
}: {
  onOpenFilters: () => void;
  onReset: () => void;
  onApply: () => void;
  resultCount: number;
  activeFilterCount: number;
  hasPendingChanges: boolean;
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <div className="overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/95 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.94),rgba(10,12,16,0.98))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground dark:text-amber-100/70">
          <span>Mobile Filter</span>
          <span>{resultCount} Treffer</span>
        </div>

        <div className="grid grid-cols-[1.15fr_0.9fr_1fr] gap-2">
          <button
            className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[1.2rem] border border-border/70 bg-background/80 px-3 text-sm font-medium dark:border-amber-400/15 dark:bg-white/[0.03] dark:text-amber-50"
            onClick={onOpenFilters}
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>

          <button
            className="flex min-h-[62px] flex-col items-center justify-center rounded-[1.2rem] border border-border/70 bg-background/80 px-3 text-center dark:border-amber-400/15 dark:bg-white/[0.03]"
            onClick={onReset}
          >
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/65">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Aktiv
            </span>
            <span className="mt-1 text-lg font-semibold text-foreground dark:text-amber-50">{activeFilterCount}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground dark:text-amber-100/72">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </span>
          </button>

          <button
            className="min-h-[62px] rounded-[1.2rem] px-4 text-sm font-semibold text-primary-foreground transition disabled:opacity-55 dark:text-[#1a1408]"
            onClick={onApply}
            disabled={!hasPendingChanges}
            style={{
              background: hasPendingChanges
                ? "linear-gradient(180deg, rgba(245,197,66,1), rgba(229,174,43,1))"
                : "linear-gradient(180deg, rgba(148,163,184,0.32), rgba(100,116,139,0.32))",
            }}
          >
            {hasPendingChanges ? "Anwenden" : "Aktiv"}
          </button>
        </div>
      </div>
    </div>
  );
}
