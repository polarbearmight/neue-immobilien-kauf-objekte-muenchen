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
      <button className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm dark:bg-black/50" onClick={onClose} aria-label="Close filters" />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[2rem] border-t border-border bg-card shadow-[0_-24px_80px_rgba(15,23,42,0.14)] dark:border-white/12 dark:bg-[rgba(10,12,16,0.98)] dark:shadow-[0_-24px_80px_rgba(0,0,0,0.35)]">
        <div className="max-h-[88vh] overflow-auto px-4 pb-24 pt-4">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-300 dark:bg-white/20" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Filter</h3>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Preis · Größe · Zimmer · Lage</p>
            </div>
            <button className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground dark:border-white/12" onClick={onClose}>Schließen</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
