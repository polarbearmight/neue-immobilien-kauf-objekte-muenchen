"use client";

import { useEffect, useState } from "react";
import { StateCard } from "@/components/state-card";
import { ContactSalesAdminCard } from "@/components/contact-sales-admin-card";

type Me = { username: string; email: string; display_name?: string | null; company?: string | null };

export function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const user = json?.user || null;
        setMe(user);
        setDisplayName(user?.display_name || "");
        setEmail(user?.email || "");
        setCompany(user?.company || "");
      })
      .catch(() => setError("Account konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setNotice(null); setError(null);
    const res = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: displayName, email, company }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error || "Profil konnte nicht gespeichert werden.");
    setMe(data.user);
    setNotice("Profil aktualisiert.");
  };

  const changePassword = async () => {
    setNotice(null); setError(null);
    const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error || "Passwort konnte nicht geändert werden.");
    setCurrentPassword(""); setNewPassword(""); setNotice("Passwort geändert.");
  };

  if (loading) return <StateCard title="Account wird geladen" body="Profil- und Sicherheitsdaten werden vorbereitet." tone="muted" />;
  if (!me) return <StateCard title="Account nicht verfügbar" body={error || "Es konnten keine Benutzerdaten geladen werden."} tone="error" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Verwalte Benutzerkonto, Passwort und eingehende Contact-Sales-Anfragen.</p>
      </div>
      {notice ? <p className="rounded border px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Profil</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Username<input disabled className="mt-2 w-full rounded-2xl border px-4 py-3 opacity-70" value={me.username} /></label>
            <label className="text-sm font-medium">Display Name<input className="mt-2 w-full rounded-2xl border px-4 py-3" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label className="text-sm font-medium">E-Mail<input className="mt-2 w-full rounded-2xl border px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="text-sm font-medium">Firma<input className="mt-2 w-full rounded-2xl border px-4 py-3" value={company} onChange={(e) => setCompany(e.target.value)} /></label>
          </div>
          <button className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white" onClick={saveProfile}>Profil speichern</button>
        </section>
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Passwort ändern</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">Aktuelles Passwort<input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
            <label className="block text-sm font-medium">Neues Passwort<input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
            <button className="rounded-2xl border px-5 py-3 text-sm font-semibold" onClick={changePassword}>Passwort aktualisieren</button>
          </div>
        </section>
      </div>
      <ContactSalesAdminCard />
    </div>
  );
}
