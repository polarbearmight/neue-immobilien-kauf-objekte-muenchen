"use client";

import { useEffect, useState } from "react";
import { StateCard } from "@/components/state-card";

type LegalData = {
  brand: string;
  owner: string;
  email: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
};

export function LegalPage({ kind }: { kind: "impressum" | "privacy" }) {
  const [data, setData] = useState<LegalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/legal/contact", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setData(json?.legal || null))
      .catch(() => setError("Rechtliche Kontaktdaten konnten nicht geladen werden."));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050608] text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,183,122,0.14),transparent_20%),linear-gradient(180deg,#050608_0%,#0a0d12_36%,#10141b_100%)]" />
        <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
          <StateCard title="Legal-Daten fehlen" body={error} tone="error" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050608] text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,183,122,0.14),transparent_20%),linear-gradient(180deg,#050608_0%,#0a0d12_36%,#10141b_100%)]" />
        <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
          <StateCard title="Legal-Daten werden geladen" body="Die rechtlichen Kontaktdaten werden vorbereitet." tone="muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,183,122,0.14),transparent_20%),linear-gradient(180deg,#050608_0%,#0a0d12_36%,#10141b_100%)]" />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-24 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight text-white">{kind === "impressum" ? "Impressum" : "Datenschutz"}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/58">
            {kind === "impressum"
              ? "Rechtliche Anbieterkennzeichnung im gleichen Premium-Look wie die restliche Plattform."
              : "Informationen zur Verarbeitung von Kontaktdaten und Zugangs-Anfragen innerhalb der Plattform."}
          </p>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-sm leading-7 text-white/72 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          {kind === "impressum" ? (
            <>
              <p><strong className="text-white">{data.brand}</strong></p>
              <p>Verantwortlich: {data.owner}</p>
              <p>{data.street}<br />{data.postal_code} {data.city}<br />{data.country}</p>
              <p>E-Mail: {data.email}<br />Telefon: {data.phone}</p>
            </>
          ) : (
            <>
              <p>Verantwortlich für die Datenverarbeitung ist {data.owner}, {data.brand}, {data.street}, {data.postal_code} {data.city}, {data.country}.</p>
              <p>Bei Nutzung des Kontaktformulars werden Name, E-Mail, Firma und Nachricht verarbeitet, um Kontaktanfragen zu bearbeiten und Zugangsanfragen zu beantworten.</p>
              <p>Die Daten werden nur für Anfragebearbeitung, Vertriebsnachverfolgung und Plattformzugang genutzt. Kontakt für Datenschutzanfragen: {data.email}.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
