"use client";

import { useEffect, useState } from "react";
import { StateCard } from "@/components/state-card";
import { ContactSalesAdminCard } from "@/components/contact-sales-admin-card";

type Me = { username: string; email: string; display_name?: string | null; company?: string | null; role?: string; effective_role?: string; license_until?: string | null };
type AdminUser = { id: number; username: string; email: string; display_name?: string | null; company?: string | null; is_active: boolean; role: string; effective_role?: string; license_until?: string | null };

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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("free");
  const [newLicenseUntil, setNewLicenseUntil] = useState("");

  const loadAdminUsers = async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setAdminUsers(data?.items || []);
  };

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (json) => {
        const user = json?.user || null;
        setMe(user);
        setDisplayName(user?.display_name || "");
        setEmail(user?.email || "");
        setCompany(user?.company || "");
        if (user?.effective_role === "admin") {
          await loadAdminUsers();
        }
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

  const createUser = async () => {
    setNotice(null); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        password: newUserPassword,
        email: newUserEmail,
        role: newUserRole,
        license_until: newLicenseUntil ? new Date(newLicenseUntil).toISOString() : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error || "User konnte nicht erstellt werden.");
    setNewUsername(""); setNewUserPassword(""); setNewUserEmail(""); setNewUserRole("free"); setNewLicenseUntil("");
    setNotice("User erstellt.");
    await loadAdminUsers();
  };

  const updateUserRole = async (userId: number, role: string) => {
    setNotice(null); setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, license_until: role === "pro" ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() : null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data?.error || "User konnte nicht aktualisiert werden.");
    setNotice("User aktualisiert.");
    await loadAdminUsers();
  };

  if (loading) return <StateCard title="Account wird geladen" body="Profil- und Sicherheitsdaten werden vorbereitet." tone="muted" />;
  if (!me) return <StateCard title="Account nicht verfügbar" body={error || "Es konnten keine Benutzerdaten geladen werden."} tone="error" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Verwalte Benutzerkonto, Passwort, Rolle/Lizenz und eingehende Contact-Sales-Anfragen.</p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Rolle: {me.effective_role || me.role || "free"}{me.license_until ? ` · Lizenz bis ${new Date(me.license_until).toLocaleDateString("de-DE")}` : ""}</p>
      </div>
      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/24 dark:bg-emerald-500/10 dark:text-emerald-100">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.86),rgba(10,12,16,0.98))] dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold">Profil</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Username<input disabled className="mt-2 w-full rounded-2xl border px-4 py-3 opacity-70 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={me.username} /></label>
            <label className="text-sm font-medium">Display Name<input className="mt-2 w-full rounded-2xl border px-4 py-3 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
            <label className="text-sm font-medium">E-Mail<input className="mt-2 w-full rounded-2xl border px-4 py-3 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="text-sm font-medium">Firma<input className="mt-2 w-full rounded-2xl border px-4 py-3 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={company} onChange={(e) => setCompany(e.target.value)} /></label>
          </div>
          <button className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-amber-300 dark:text-[#1a1408]" onClick={saveProfile}>Profil speichern</button>
        </section>
        <section className="rounded-3xl border bg-card p-6 shadow-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.86),rgba(10,12,16,0.98))] dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold">Passwort ändern</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">Aktuelles Passwort<input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
            <label className="block text-sm font-medium">Neues Passwort<input type="password" className="mt-2 w-full rounded-2xl border px-4 py-3 dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
            <button className="rounded-2xl border px-5 py-3 text-sm font-semibold dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" onClick={changePassword}>Passwort aktualisieren</button>
          </div>
        </section>
      </div>
      {me.effective_role === "admin" ? (
        <section className="rounded-3xl border bg-card p-6 shadow-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.86),rgba(10,12,16,0.98))] dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <h2 className="text-lg font-semibold">User-Admin</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input className="rounded-2xl border px-4 py-3" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            <input className="rounded-2xl border px-4 py-3" placeholder="E-Mail" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
            <input type="password" className="rounded-2xl border px-4 py-3" placeholder="Passwort" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
            <select className="rounded-2xl border px-4 py-3" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}><option value="free">free</option><option value="pro">pro</option><option value="admin">admin</option></select>
            <input type="date" className="rounded-2xl border px-4 py-3" value={newLicenseUntil} onChange={(e) => setNewLicenseUntil(e.target.value)} />
          </div>
          <button className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-amber-300 dark:text-[#1a1408]" onClick={createUser}>User erstellen</button>
          <div className="mt-6 space-y-3">
            {adminUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm">
                <div>
                  <p className="font-medium">{u.username} · {u.email}</p>
                  <p className="text-muted-foreground">aktuell: {u.effective_role || u.role}{u.license_until ? ` · bis ${new Date(u.license_until).toLocaleDateString("de-DE")}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-xl border px-3 py-2" onClick={() => updateUserRole(u.id, "free")}>free</button>
                  <button className="rounded-xl border px-3 py-2" onClick={() => updateUserRole(u.id, "pro")}>pro</button>
                  <button className="rounded-xl border px-3 py-2" onClick={() => updateUserRole(u.id, "admin")}>admin</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {me.effective_role === "admin" ? <ContactSalesAdminCard /> : null}
    </div>
  );
}
