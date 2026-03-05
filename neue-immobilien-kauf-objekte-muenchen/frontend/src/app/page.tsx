"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL, Listing } from "@/lib/api";
import { ListingDrawer } from "@/components/listing-drawer";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { ListingTable } from "@/components/listing-table";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

type Stats = {
  new_listings: number;
  avg_price_per_sqm: number | null;
  top_deals?: number;
  series?: Array<{ date: string; count: number; avg_ppsqm: number | null }>;
};

export default function Page() {
  const [items, setItems] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [sort, setSort] = useState("newest");
  const [minScore, setMinScore] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("-");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams({ bucket, sort, limit: "500", min_score: String(minScore) });
      const [lRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/listings?${params.toString()}`, { cache: "no-store" }),
        fetch(`${API_URL}/api/stats?days=7`, { cache: "no-store" }),
      ]);
      const [lData, sData] = await Promise.all([lRes.json(), sRes.json()]);
      setItems(Array.isArray(lData) ? lData : []);
      setStats(sData || null);
      setLastUpdated(new Date().toLocaleTimeString("de-DE"));
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Deal Finder · neueste zuerst · lokale Datenbank</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-xs"
            onClick={() => {
              const header = ["title", "district", "source", "price_eur", "price_per_sqm", "score", "url"];
              const rows = filtered.map((l) => [
                (l.title || "").replaceAll(",", " "),
                (l.district || "").replaceAll(",", " "),
                l.source,
                String(l.price_eur ?? ""),
                String(l.price_per_sqm ?? ""),
                String(Math.round(l.deal_score || 0)),
                l.url,
              ]);
              const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "listings-export.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export CSV
          </button>
          <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">New last 7d</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.new_listings ?? 0}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Median/avg €/m²</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(stats?.avg_price_per_sqm)}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Top deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.top_deals ?? 0}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Shown</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{filtered.length}</CardContent></Card>
      </div>

      {stats?.series?.length ? (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Listings per day (7d)</CardTitle></CardHeader>
          <CardContent>
            <MiniBarChart data={stats.series.map((s) => ({ label: s.date, value: s.count }))} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit rounded-2xl lg:sticky lg:top-6">
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

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-lg">Listings ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : <ListingTable rows={filtered} onDetails={setSelected} />}
          </CardContent>
        </Card>
      </div>
      <ListingDrawer listing={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
