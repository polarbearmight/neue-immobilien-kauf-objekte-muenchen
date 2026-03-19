"use client";

export function MobileFilterSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-label="Close filters" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[2rem] border-t border-white/12 bg-[rgba(10,12,16,0.98)] shadow-[0_-24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="px-4 pb-24 pt-4 overflow-auto max-h-[88vh]">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Filter</h3>
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">Preis · Größe · Zimmer · Lage</p>
            </div>
            <button className="rounded-xl border border-white/12 px-3 py-2 text-sm text-white/70" onClick={onClose}>Schließen</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
