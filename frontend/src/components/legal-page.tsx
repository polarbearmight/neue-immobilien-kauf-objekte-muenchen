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

  if (error) return <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8"><StateCard title="Legal-Daten fehlen" body={error} tone="error" /></div>;
  if (!data) return <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8"><StateCard title="Legal-Daten werden geladen" body="Die rechtlichen Kontaktdaten werden vorbereitet." tone="muted" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight text-slate-950">{kind === "impressum" ? "Impressum" : "Datenschutz"}</h1>
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-sm leading-7 text-slate-700">
        {kind === "impressum" ? (
          <>
            <p><strong>{data.brand}</strong></p>
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
  );
}
