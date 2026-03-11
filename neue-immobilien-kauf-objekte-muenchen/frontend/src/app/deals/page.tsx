"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, Listing } from "@/lib/api";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export default function DealsPage() {
  const [minScore, setMinScore] = useState(85);
  const [sortBy, setSortBy] = useState<"score" | "investment">("score");
  const [listings, setListings] = useState<Listing[]>([]);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_URL}/api/listings?min_score=${minScore}&sort=score&limit=160`, { cache: "no-store" });
      setListings(await res.json());
    };
    load();
  }, [minScore]);

  const sortedListings = useMemo(() => {
    const rows = [...listings];
    if (sortBy === "investment") {
      rows.sort((a, b) => (b.investment_score || 0) - (a.investment_score || 0));
      return rows;
    }
    rows.sort((a, b) => (b.deal_score || 0) - (a.deal_score || 0));
    return rows;
  }, [listings, sortBy]);

  const saveToWatchlist = async (listingId?: number) => {
    if (!listingId) return;
    setSavingIds((prev) => ({ ...prev, [listingId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${listingId}`, { method: "POST" });
      if (!res.ok) throw new Error("watchlist_save_failed");
      setSavedIds((prev) => ({ ...prev, [listingId]: true }));
    } catch {
      // keep silent in UI for now
    } finally {
      setSavingIds((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Deal Radar</h1>
        <div className="flex items-end gap-3 text-sm">
          <div className="w-72">
            <label className="mb-1 block text-muted-foreground">Min score: {minScore}</label>
            <input className="w-full" type="range" min={70} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Sort</label>
            <select className="rounded border px-2 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "investment") }>
              <option value="score">Score</option>
              <option value="investment">Investment Score</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedListings.map((l) => {
          const h = listingHighlightBadges(l);
          const rowClass = listingHighlightRowClass(l);
          const isUltra = (l.deal_score || 0) >= 95;
          return (
            <div key={`${l.source}-${l.source_listing_id}`} className={`rounded-xl border p-4 text-sm ${rowClass} ${isUltra ? "shadow-md" : ""}`}>
              <div className="mb-2 flex min-h-6 items-center gap-1 overflow-hidden whitespace-nowrap">
                {h.slice(0, 3).map((b) => <span key={b.key} className={`rounded border px-1.5 py-0.5 text-[10px] ${badgeToneClass(b.tone)}`}>{b.label}</span>)}
                {h.length > 3 ? <span className="text-[10px] text-muted-foreground">+{h.length - 3}</span> : null}
              </div>
              <p className="mb-1 text-lg font-semibold">Score {Math.round(l.deal_score || 0)}{l.investment_score != null ? ` · Inv ${Math.round(l.investment_score)}` : ""}</p>
              <p className="font-medium">{l.display_title || l.title || "Ohne Titel"}</p>
              <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
              <p className="mt-2">{eur(l.price_eur)} · {eur(l.price_per_sqm)}/m²</p>
              <div className="mt-2 flex gap-2">
                <a href={l.url} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs">Open</a>
                <button
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => saveToWatchlist(l.id)}
                  disabled={!l.id || !!savingIds[l.id]}
                >
                  {l.id && savingIds[l.id] ? "Saving..." : l.id && savedIds[l.id] ? "Saved" : "Save to Watchlist"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
