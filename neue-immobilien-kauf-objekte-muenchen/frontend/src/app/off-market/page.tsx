"use client";

import { useEffect, useState } from "react";
import { Listing, getOffMarket } from "@/lib/api";
import { badgeToneClass, listingHighlightBadges } from "@/lib/deal-highlights";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export default function OffMarketPage() {
  const [minScore, setMinScore] = useState(60);
  const [district, setDistrict] = useState("");
  const [rows, setRows] = useState<Listing[]>([]);

  useEffect(() => {
    const load = async () => {
      const q = new URLSearchParams();
      q.set("min_score", String(minScore));
      q.set("limit", "120");
      if (district.trim()) q.set("district", district.trim());
      setRows(await getOffMarket(q.toString()));
    };
    load();
  }, [minScore, district]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Off-Market Detector</h1>
        <div className="flex items-end gap-3 text-sm">
          <div className="w-56">
            <label className="mb-1 block text-muted-foreground">Min off-market score: {minScore}</label>
            <input className="w-full" type="range" min={40} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">District</label>
            <input className="rounded border px-2 py-1" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Schwabing" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((l) => {
          const badges = listingHighlightBadges(l);
          return (
            <div key={`${l.source}-${l.source_listing_id}`} className="rounded-xl border p-4 text-sm">
              <div className="mb-2 flex min-h-6 items-center gap-1 overflow-hidden whitespace-nowrap">
                {badges.slice(0, 3).map((b) => <span key={b.key} className={`rounded border px-1.5 py-0.5 text-[10px] ${badgeToneClass(b.tone)}`}>{b.label}</span>)}
                {badges.length > 3 ? <span className="text-[10px] text-muted-foreground">+{badges.length - 3}</span> : null}
              </div>
              <p className="mb-1 text-lg font-semibold">Off-Market {Math.round(l.off_market_score || 0)}</p>
              <p className="font-medium">{l.display_title || l.title || "Ohne Titel"}</p>
              <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
              <p className="mt-2">{eur(l.price_eur)} · {eur(l.price_per_sqm)}/m²</p>
              <p className="mt-2 text-xs text-muted-foreground">Exclusivity {Math.round(l.exclusivity_score || 0)} · Source popularity {Math.round(l.source_popularity_score || 0)}</p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{l.off_market_explain || "-"}</p>
              <div className="mt-2 flex gap-2">
                <a href={l.url} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs">Open</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
