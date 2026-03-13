"use client";

import { useState } from "react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError("Bitte ein Passwort mit mindestens 8 Zeichen setzen.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Reset fehlgeschlagen.");
      return;
    }
    setNotice("Passwort aktualisiert. Du kannst dich jetzt mit dem neuen Passwort anmelden.");
    setPassword("");
    setConfirm("");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="rounded-3xl border bg-white p-8 shadow-sm space-y-5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Neues Passwort festlegen</h1>
        <label className="block text-sm font-medium text-slate-700">Neues Passwort
          <input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Passwort wiederholen
          <input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        <button type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Passwort speichern</button>
      </form>
    </div>
  );
}
