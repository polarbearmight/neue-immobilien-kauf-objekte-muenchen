import type { ReactNode } from "react";

export function StateCard({
  title,
  body,
  tone = "default",
  action,
}: {
  title: string;
  body: string;
  tone?: "default" | "error" | "muted";
  action?: ReactNode;
}) {
  const toneClass = tone === "error"
    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
    : tone === "muted"
      ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.82),rgba(10,12,16,0.98))] dark:text-amber-50"
      : "border-slate-200 bg-white text-slate-900 dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.86),rgba(10,12,16,0.98))] dark:text-amber-50";

  return (
    <div className={`rounded-3xl border p-6 shadow-sm dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)] ${toneClass}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-90">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
