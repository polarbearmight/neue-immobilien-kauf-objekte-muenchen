"use client";

import { useState } from "react";

export function ContactSalesForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Anfrage konnte nicht gesendet werden.");
      } else {
        setNotice(data?.message || "Vielen Dank. Wir melden uns zeitnah.");
        setName("");
        setEmail("");
        setCompany("");
        setMessage("");
      }
    } catch {
      setError("Anfrage konnte nicht gesendet werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className={`space-y-4 ${compact ? "" : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">Name
          <input required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">E-Mail
          <input required type="email" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">Firma / Kontext
        <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={company} onChange={(e) => setCompany(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-slate-700">Nachricht
        <textarea required rows={5} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={loading} className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? "Wird gesendet…" : "Anfrage senden"}</button>
    </form>
  );
}
