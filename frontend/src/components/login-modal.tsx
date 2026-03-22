"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error === "too_many_login_attempts" ? "Zu viele Login-Versuche. Bitte kurz warten." : data?.error || "Login fehlgeschlagen");
        setLoading(false);
        return;
      }
      if (typeof window !== "undefined") {
        const user = data?.user || null;
        if (user) {
          window.localStorage.setItem("munich-dealfinder-role-cache", JSON.stringify(user));
          window.dispatchEvent(new CustomEvent("mdf-role-updated", { detail: user }));
        }
      }
      setSuccess(true);
      const redirect = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      setTimeout(() => {
        onClose();
        router.push(redirect || "/dashboard");
        router.refresh();
      }, 220);
    } catch {
      setError("Login fehlgeschlagen");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-[28px] border border-white/60 bg-white/95 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.25)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-700">Munich Deal Finder</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Willkommen zurück</h2>
            <p className="mt-2 text-sm text-slate-500">Melde dich an, um auf das SaaS-Dashboard und die Deal-Engine zuzugreifen.</p>
          </div>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500 transition hover:bg-slate-50" onClick={onClose}>✕</button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Username
            <input autoComplete="username" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <input autoComplete="current-password" type="password" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">Login erfolgreich – Dashboard wird geöffnet…</p> : null}
          <button type="submit" disabled={loading || success} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? "Anmelden…" : success ? "Weiterleiten…" : "Login"}</button>
        </form>
      </div>
    </div>
  );
}
