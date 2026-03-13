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
      <button className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={onClose} aria-label="Close filters" />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-auto rounded-t-[2rem] border-t border-white/70 bg-white/95 px-4 pb-8 pt-4 shadow-[0_-24px_80px_rgba(15,23,42,0.2)] backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Filter</h3>
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  );
}
