"use client";

import { useEffect, useState } from "react";
import { API_URL, Listing } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

type DropRow = Listing & { prev_price_eur?: number | null; drop_pct?: number | null };

export default function PriceDropsPage() {
  const [items, setItems] = useState<DropRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_URL}/api/price-drops`, { cache: "no-store" });
      const listings: Listing[] = await res.json();

      const enriched = await Promise.all(
        listings.slice(0, 60).map(async (l) => {
          if (!l.id) return l as DropRow;
          try {
            const sRes = await fetch(`${API_URL}/api/listings/${l.id}/snapshots?limit=5`, { cache: "no-store" });
            const snaps = await sRes.json();
            const prev = Array.isArray(snaps) && snaps.length > 1 ? snaps[1]?.price_eur : null;
            const now = l.price_eur ?? null;
            const drop = prev && now ? ((prev - now) / prev) * 100 : null;
            return { ...l, prev_price_eur: prev, drop_pct: drop } as DropRow;
          } catch {
            return l as DropRow;
          }
        })
      );

      setItems(enriched);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Price Drops</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((l) => (
          <div key={`${l.source}-${l.source_listing_id}`} className="rounded-xl border p-4 text-sm">
            <p className="font-medium">{l.title || "Ohne Titel"}</p>
            <p className="text-muted-foreground">{l.district || "-"} · {l.source}</p>
            <p className="mt-2">Neu: <span className="font-semibold">{eur(l.price_eur)}</span> · {eur(l.price_per_sqm)}/m²</p>
            <p>Alt: {eur(l.prev_price_eur)} {l.drop_pct ? <span className="ml-1 rounded border border-green-300 bg-green-50 px-1 py-0.5 text-xs text-green-700">-{l.drop_pct.toFixed(1)}%</span> : null}</p>
            <a className="mt-2 inline-block text-xs underline" href={l.url} target="_blank" rel="noreferrer">Open</a>
          </div>
        ))}
      </div>
    </div>
  );
}
