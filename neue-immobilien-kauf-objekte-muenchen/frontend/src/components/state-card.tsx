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
    ? "border-red-200 bg-red-50 text-red-900"
    : tone === "muted"
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${toneClass}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-90">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
