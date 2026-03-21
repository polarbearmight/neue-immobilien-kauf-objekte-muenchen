type Props = {
  role: "free" | "pro" | "admin";
  title: string;
  body: string;
};

export function RoleBanner({ role, title, body }: Props) {
  const tone = role === "admin"
    ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
    : role === "pro"
      ? "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/16 dark:text-amber-100"
      : "border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold uppercase tracking-[0.18em]">{role} · {title}</p>
      <p className="mt-1 opacity-90">{body}</p>
    </div>
  );
}
