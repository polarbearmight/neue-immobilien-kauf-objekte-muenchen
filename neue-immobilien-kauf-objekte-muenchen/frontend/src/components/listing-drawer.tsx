"use client";

import { Listing } from "@/lib/api";
import { Button } from "@/components/ui/button";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export function ListingDrawer({ listing, onClose }: { listing: Listing | null; onClose: () => void }) {
  if (!listing) return null;
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
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
            <div><p className="text-muted-foreground">Preis</p><p className="font-medium">{eur(listing.price_eur)}</p></div>
            <div><p className="text-muted-foreground">€/m²</p><p className="font-medium">{eur(listing.price_per_sqm)}</p></div>
            <div><p className="text-muted-foreground">Fläche</p><p className="font-medium">{listing.area_sqm || "-"} m²</p></div>
            <div><p className="text-muted-foreground">Zimmer</p><p className="font-medium">{listing.rooms || "-"}</p></div>
            <div><p className="text-muted-foreground">Score</p><p className="font-medium">{Math.round(listing.deal_score || 0)}</p></div>
            <div><p className="text-muted-foreground">First Seen</p><p className="font-medium">{new Date(listing.first_seen_at).toLocaleString("de-DE")}</p></div>
          </div>

          <div>
            <p className="mb-1 font-medium">Badges</p>
            <p className="rounded border p-2 text-muted-foreground">{listing.badges || "-"}</p>
          </div>
          <div>
            <p className="mb-1 font-medium">Score Explain</p>
            <p className="rounded border p-2 text-muted-foreground">{listing.score_explain || "-"}</p>
          </div>
          <div>
            <p className="mb-1 font-medium">AI Flags</p>
            <p className="rounded border p-2 text-muted-foreground">{listing.ai_flags || "-"}</p>
          </div>

          <a href={listing.url} target="_blank" rel="noreferrer" className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted">Open listing</a>
        </div>
      </aside>
    </div>
  );
}
