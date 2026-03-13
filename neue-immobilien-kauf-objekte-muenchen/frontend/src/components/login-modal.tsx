"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Login fehlgeschlagen");
        setLoading(false);
        return;
      }
      onClose();
      const redirect = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      router.push(redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("Login fehlgeschlagen");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Munich Deal Finder</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Login</h2>
            <p className="mt-2 text-sm text-slate-500">Zugang zum Dashboard mit Demo-Credentials.</p>
          </div>
          <button className="rounded-full border px-3 py-1 text-sm text-slate-500 transition hover:bg-slate-50" onClick={onClose}>✕</button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Username
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <input type="password" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? "Anmelden…" : "Login"}</button>
        </form>
        <p className="mt-4 text-xs text-slate-400">Demo: admin / admin123</p>
      </div>
    </div>
  );
}
