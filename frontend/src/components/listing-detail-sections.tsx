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
    <section className="rounded-[1.6rem] border border-white/70 bg-white/90 p-5 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.88),rgba(10,12,16,0.98))] dark:text-amber-50 dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-amber-100/68">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-amber-100/70">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricTile({ label, value, emphasize = false }: { label: string; value: React.ReactNode; emphasize?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${emphasize ? "border-slate-900 bg-slate-950 text-white dark:border-amber-300/36 dark:bg-amber-300 dark:text-[#1a1408]" : "border-slate-200 bg-slate-50 text-slate-900 dark:border-amber-400/14 dark:bg-white/[0.04] dark:text-amber-50"}`}>
      <div className={`text-xs ${emphasize ? "text-white/70 dark:text-[#5a430c]" : "text-slate-500 dark:text-amber-100/62"}`}>{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
