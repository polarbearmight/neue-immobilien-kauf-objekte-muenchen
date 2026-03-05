"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL, Listing } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

function badgesFor(l: Listing): string[] {
  const out: string[] = [];
  const ageHours = (Date.now() - new Date(l.first_seen_at).getTime()) / 3600000;
  if (ageHours <= 2) out.push("🔥 JUST_LISTED");
  else if (ageHours <= 6) out.push("🟢 BRAND_NEW");
  if ((l.deal_score || 0) >= 92) out.push("💎 ULTRA");
  else if ((l.deal_score || 0) >= 85) out.push("⭐ TOP_DEAL");
  if (l.badges?.includes("PRICE_DROP")) out.push("⬇ PRICE_DROP");
  if (l.badges?.includes("CHECK")) out.push("⚠ CHECK");
  return out;
}

export default function Page() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [sort, setSort] = useState("newest");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams({ bucket, sort, limit: "500", min_score: String(minScore) });
      const res = await fetch(`${API_URL}/api/listings?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    load();
  }, [bucket, sort, minScore]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => `${x.title || ""} ${x.district || ""}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Deal Finder · neueste zuerst · lokale Datenbank</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-muted-foreground">Search</label>
              <input className="w-full rounded-md border px-3 py-2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel / Stadtteil" />
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Bucket</label>
              <select className="w-full rounded-md border px-3 py-2" value={bucket} onChange={(e) => setBucket(e.target.value)}>
                <option value="all">All</option>
                <option value="9000">≤ 9000 €/m²</option>
                <option value="12000">≤ 12000 €/m²</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Sort</label>
              <select className="w-full rounded-md border px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest</option>
                <option value="score">Score</option>
                <option value="ppsm">€/m²</option>
                <option value="price">Price</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Min Score: {minScore}</label>
              <input className="w-full" type="range" min={0} max={100} step={1} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Listings ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : (
              <div className="space-y-2">
                {filtered.map((l) => {
                  const score = l.deal_score || 0;
                  const rowClass = score >= 92 ? "border-l-4 bg-muted/60" : score >= 85 ? "bg-muted/30" : "";
                  return (
                    <a key={`${l.source}-${l.source_listing_id}`} href={l.url} target="_blank" rel="noreferrer" className={`block rounded-lg border p-3 text-sm hover:bg-muted/40 ${rowClass}`}>
                      <div className="mb-1 flex flex-wrap gap-2 text-xs">
                        {badgesFor(l).map((b) => <span key={b} className="rounded-full border px-2 py-0.5">{b}</span>)}
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{l.title || "Ohne Titel"}</p>
                          <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi. · {l.source}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{eur(l.price_eur)}</p>
                          <p className="text-muted-foreground">{eur(l.price_per_sqm)}/m² · Score {Math.round(score)}</p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
