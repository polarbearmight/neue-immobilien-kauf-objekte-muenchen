"use client";

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
    <div className="sticky bottom-3 z-40 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[1.6rem] border border-white/70 bg-white/90 px-3 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
        <button className="min-h-11 rounded-2xl border px-4 py-2 text-sm font-medium" onClick={onOpenFilters}>Filter</button>
        <div className="text-center text-sm text-slate-600">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Treffer</div>
          <div className="font-semibold text-slate-950">{resultCount}</div>
        </div>
        <button className="min-h-11 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={onRefresh}>Refresh</button>
      </div>
    </div>
  );
}
