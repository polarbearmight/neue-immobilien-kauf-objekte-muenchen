"use client";

import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";

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
        setError(data?.error === "too_many_requests" ? "Zu viele Anfragen in kurzer Zeit. Bitte später erneut versuchen." : data?.error || "Anfrage konnte nicht gesendet werden.");
      } else {
        setNotice(`${data?.message || "Vielen Dank. Wir melden uns zeitnah."}${data?.lead_id ? ` (Lead #${data.lead_id})` : ""}`);
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
    <form
      onSubmit={submit}
      className={`space-y-5 ${compact ? "" : "rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
            <Lock className="h-3.5 w-3.5 text-[#d2b77a]" />
            Concierge Review
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">Zugang anfragen</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/50">Private Onboarding für Käufer, Investoren und Teams mit Fokus auf München.</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-white/70">Name
        <input
          required
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
      </label>
      <label className="block text-sm font-medium text-white/70">E-Mail
        <input
          required
          type="email"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
        />
      </label>
      <label className="block text-sm font-medium text-white/70">Kontext
        <input
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Privatinvestor, Family Office, Makler …"
        />
      </label>
      <label className="block text-sm font-medium text-white/70">Kurze Nachricht (optional)
        <textarea
          rows={4}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition placeholder:text-white/20 focus:border-[#d2b77a]/45 focus:ring-4 focus:ring-[#d2b77a]/10"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional: Suchprofil, Markt oder Zielobjekte kurz beschreiben."
        />
      </label>
      {notice ? <p className="text-sm text-[#e7d2a4]">{notice}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d2b77a] px-6 py-3 text-sm font-semibold text-[#17181c] transition hover:bg-[#dcc38d] disabled:opacity-60"
        >
          {loading ? "Wird gesendet…" : "Zugang anfragen →"}
          {!loading ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-white/32">Concierge Review · Private Onboarding · Kein Spam</p>
      </div>
    </form>
  );
}
