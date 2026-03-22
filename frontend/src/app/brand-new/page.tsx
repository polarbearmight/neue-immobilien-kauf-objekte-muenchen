"use client";

import { useEffect, useState } from "react";
import { API_URL, authHeaders, type Listing } from "@/lib/api";
import { StateCard } from "@/components/state-card";

function ageLabel(firstSeen: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(firstSeen).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

export default function BrandNewPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/listings?brand_new=true&sort=newest&limit=5000`, { cache: "no-store", headers: authHeaders() });
        if (!res.ok) throw new Error(`brand_new_${res.status}`);
        setListings(await res.json());
      } catch {
        setListings([]);
        setError("Brand-New-Listings konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <StateCard title="Brand New wird geladen" body="Die neuesten Listings werden vorbereitet." tone="muted" />;
  if (error) return <StateCard title="Brand New nicht verfügbar" body={error} tone="error" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Brand New</h1>
      {listings.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">Keine brandneuen Listings gefunden.</div>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={`${l.source}-${l.source_listing_id}`} className="rounded-xl border p-3 text-sm">
              <p className="font-medium">{l.display_title || l.title || "Ohne Titel"}</p>
              <p className="text-muted-foreground">{ageLabel(l.first_seen_at)} · {l.district || "-"} · {l.source}</p>
              <a href={l.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Open</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
