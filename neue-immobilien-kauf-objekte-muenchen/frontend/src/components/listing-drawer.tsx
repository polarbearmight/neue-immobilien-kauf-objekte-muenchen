"use client";

import { useEffect, useState } from "react";
import { Listing, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

type Snapshot = { id: number; captured_at: string; price_eur?: number | null };

export function ListingDrawer({ listing, onClose }: { listing: Listing | null; onClose: () => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!listing?.id) return setSnapshots([]);
      const res = await fetch(`${API_URL}/api/listings/${listing.id}/snapshots?limit=20`, { cache: "no-store" });
      const data = await res.json();
      setSnapshots(Array.isArray(data) ? data : []);
    };
    load();
  }, [listing?.id]);

  if (!listing) return null;
  const badgeList = (listing.badges || "").split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listing Details</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-base font-semibold">{listing.title || "Ohne Titel"}</p>
          <p className="text-muted-foreground">{listing.district || "-"} · {listing.source}</p>
          <div className="flex flex-wrap gap-1">
            {badgeList.length ? badgeList.map((b) => <span key={b} className="rounded-full border px-2 py-0.5 text-xs">{b}</span>) : <span className="text-xs text-muted-foreground">No badges</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
            <div><p className="text-muted-foreground">Preis</p><p className="font-medium">{eur(listing.price_eur)}</p></div>
            <div><p className="text-muted-foreground">€/m²</p><p className="font-medium">{eur(listing.price_per_sqm)}</p></div>
            <div><p className="text-muted-foreground">Fläche</p><p className="font-medium">{listing.area_sqm || "-"} m²</p></div>
            <div><p className="text-muted-foreground">Zimmer</p><p className="font-medium">{listing.rooms || "-"}</p></div>
            <div><p className="text-muted-foreground">Score</p><p className="font-medium">{Math.round(listing.deal_score || 0)}</p></div>
            <div><p className="text-muted-foreground">First Seen</p><p className="font-medium">{new Date(listing.first_seen_at).toLocaleString("de-DE")}</p></div>
          </div>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">Score Explain</summary>
            <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{listing.score_explain || "-"}</p>
          </details>
          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">AI Flags</summary>
            <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{listing.ai_flags || "-"}</p>
          </details>
          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">Price history</summary>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {snapshots.length ? snapshots.map((s) => (
                <p key={s.id}>{new Date(s.captured_at).toLocaleString("de-DE")} · {eur(s.price_eur)}</p>
              )) : <p>-</p>}
            </div>
          </details>

          <div className="flex gap-2">
            <a href={listing.url} target="_blank" rel="noreferrer" className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted">Open listing</a>
            <button
              className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted"
              onClick={async () => {
                if (!listing.id) return;
                await fetch(`${API_URL}/api/watchlist/${listing.id}`, { method: "POST" });
              }}
            >
              Save to Watchlist
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
