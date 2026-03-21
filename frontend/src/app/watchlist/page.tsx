"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type WatchItem = {
  id: number;
  created_at?: string;
  notes?: string | null;
  listing: {
    id?: number;
    source?: string;
    title?: string;
    district?: string;
    deal_score?: number | null;
    price_eur?: number | null;
    price_per_sqm?: number | null;
    url: string;
  };
};

const eur = (v?: number | null) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/watchlist`, { cache: "no-store" });
      if (!res.ok) throw new Error(`watchlist_${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError("Watchlist konnte nicht geladen werden.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const avgScore =
      total > 0
        ? Math.round(
            items.reduce((acc, x) => acc + Number(x.listing?.deal_score || 0), 0) / total
          )
        : 0;
    return { total, avgScore };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <button className="rounded-2xl border px-3 py-2 text-sm dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50" onClick={load}>
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.4rem] border p-3 text-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.82),rgba(10,12,16,0.98))]">Einträge: <span className="font-semibold">{stats.total}</span></div>
        <div className="rounded-[1.4rem] border p-3 text-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.82),rgba(10,12,16,0.98))]">Ø Score: <span className="font-semibold">{stats.avgScore}</span></div>
      </div>

      {error ? <StateCard title="Watchlist nicht verfügbar" body={error} tone="error" /> : null}

      {loading ? (
        <StateCard title="Watchlist wird geladen" body="Gespeicherte Immobilien werden gerade aus der Datenbank geladen." tone="muted" />
      ) : items.length === 0 ? (
        <StateCard title="Noch leer" body="Du hast noch keine Immobilien zur Watchlist hinzugefügt. Nutze 'Merken' im Dashboard oder Deal Radar." tone="muted" />
      ) : (
        <div className="space-y-2">
          {items.map((w) => (
            <div key={w.id} className="rounded-[1.5rem] border p-4 text-sm dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.82),rgba(10,12,16,0.98))] dark:shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <p className="font-medium">{w.listing.title || "Ohne Titel"}</p>
              <p className="text-muted-foreground">
                {w.listing.district || "-"} · Score {Math.round(w.listing.deal_score || 0)} · {eur(w.listing.price_eur)} · {eur(w.listing.price_per_sqm)}/m²
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Quelle: {w.listing.source || "-"}</p>
              <div className="mt-2 flex gap-2">
                <a href={w.listing.url} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-xs dark:border-amber-400/16 dark:bg-white/[0.04] dark:text-amber-50">
                  Öffnen
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
