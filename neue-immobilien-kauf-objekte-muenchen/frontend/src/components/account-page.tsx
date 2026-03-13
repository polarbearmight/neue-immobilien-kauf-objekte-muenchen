"use client";

import { useState } from "react";

export function AccountPage() {
  const [displayName, setDisplayName] = useState("Marius");
  const [email, setEmail] = useState("admin@immodealfinder.de");
  const [company, setCompany] = useState("ImmoDealFinder");
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Verwalte Profil, Zugang und bevorzugte Nutzung der Plattform.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Profil</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Name
              <input className="mt-2 w-full rounded-2xl border px-4 py-3" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="text-sm font-medium">E-Mail
              <input className="mt-2 w-full rounded-2xl border px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-sm font-medium md:col-span-2">Firma / Team
              <input className="mt-2 w-full rounded-2xl border px-4 py-3" value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
          </div>
          {notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
          <button className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white" onClick={() => setNotice("Änderungen lokal gespeichert. Persistente Benutzerverwaltung folgt im nächsten Schritt.")}>Änderungen speichern</button>
        </section>

        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sicherheit</h2>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Passwort zurücksetzen</p>
              <p className="mt-1">Nutze den integrierten Reset-Flow, um ein neues Passwort für den Demo-Zugang zu setzen.</p>
              <a href="/forgot-password" className="mt-3 inline-flex rounded-xl border px-4 py-2 text-foreground">Reset starten</a>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Session</p>
              <p className="mt-1">Der Login bleibt aktuell gerätebezogen gespeichert.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
