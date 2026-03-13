"use client";

export function prettyJson(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function SectionCard({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.6rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({ label, value, emphasize = false }: { label: string; value: React.ReactNode; emphasize?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${emphasize ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}>
      <div className={`text-xs ${emphasize ? "text-white/70" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
