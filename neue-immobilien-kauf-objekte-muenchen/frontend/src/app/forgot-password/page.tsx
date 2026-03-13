"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null); setError(null); setToken(null);
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error || "Reset konnte nicht vorbereitet werden.");
    setNotice(data?.message || "Reset vorbereitet.");
    if (data?.reset_token) setToken(data.reset_token);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="rounded-3xl border bg-white p-8 shadow-sm space-y-5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Passwort vergessen</h1>
        <p className="text-slate-600">Fordere einen Reset-Link für dein Benutzerkonto an. Für dieses Setup wird der Token direkt angezeigt, damit du den Flow testen kannst.</p>
        <label className="block text-sm font-medium text-slate-700">E-Mail
          <input type="email" className="mt-2 w-full rounded-2xl border px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        {token ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Reset-Token: <code>{token}</code><br />Nutze ihn direkt auf <a className="underline" href={`/reset-password?token=${encodeURIComponent(token)}`}>/reset-password</a>.</div> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Reset anfordern</button>
      </form>
    </div>
  );
}
