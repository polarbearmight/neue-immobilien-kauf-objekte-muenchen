"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error === "too_many_login_attempts" ? "Zu viele Login-Versuche. Bitte kurz warten." : data?.error || "Login fehlgeschlagen");
        setLoading(false);
        return;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#0c0f15_0%,#121720_100%)] p-8 shadow-[0_40px_140px_rgba(0,0,0,0.5)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#d2b77a]/60 to-transparent" />
        <div className="absolute -right-10 top-8 h-32 w-32 rounded-full bg-[#d2b77a]/10 blur-3xl" />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/60">
              <Lock className="h-3.5 w-3.5 text-[#d2b77a]" />
              Private Access
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Willkommen zurück</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/52">Login zum Premium-Dashboard und zur kuratierten Deal-Oberfläche.</p>
          </div>
          <button className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white" onClick={onClose}>✕</button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-white/72">Username
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </label>
          <label className="block text-sm font-medium text-white/72">Password
            <input
              autoComplete="current-password"
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-[#e7d2a4]">Login erfolgreich – Dashboard wird geöffnet…</p> : null}
          <button
            type="submit"
            disabled={loading || success}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d2b77a] px-4 py-3 font-medium text-[#17181c] transition hover:bg-[#dcc38d] disabled:opacity-60"
          >
            {loading ? "Anmelden…" : success ? "Weiterleiten…" : "Login"}
            {!loading && !success ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>
      </div>
    </div>
  );
}
