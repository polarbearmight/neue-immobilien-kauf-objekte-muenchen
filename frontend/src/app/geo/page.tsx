"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, authHeaders } from "@/lib/api";

type DistrictRow = {
  district: string;
  listing_count: number;
  median_price_per_sqm: number | null;
  average_price_per_sqm: number | null;
  average_deal_score: number | null;
  average_off_market_score: number | null;
  top_deal_count: number;
  just_listed_count: number;
  price_drop_count: number;
  hotspot_score: number;
  trend: "up" | "down" | "flat" | string;
};

const eur = (v?: number | null) => (v == null ? "-" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €/m²`);

export default function GeoPage() {
  const [mode, setMode] = useState("deal_density");
  const [window, setWindow] = useState("30d");
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState("all");
  const [district, setDistrict] = useState("all");
  const [view, setView] = useState<"district" | "coordinate">("district");
  const [rows, setRows] = useState<DistrictRow[]>([]);
  const [hotspots, setHotspots] = useState<DistrictRow[]>([]);
  const [summary, setSummary] = useState<{ total_listings?: number; districts?: number; top_deals?: number } | null>(null);
  const [cells, setCells] = useState<Array<{ cell: string; listing_count: number; top_deal_count: number }>>([]);
  const [sources, setSources] = useState<string[]>(["all"]);

  useEffect(() => {
    fetch(`${API_URL}/api/sources`, { cache: "no-store" })
      .then((r) => r.json())
      .then((rows) => {
        const dynamicSources = Array.isArray(rows) ? rows.map((x: { name?: string }) => x.name).filter((v): v is string => Boolean(v)) : [];
        setSources(["all", ...Array.from(new Set(dynamicSources)).sort((a, b) => a.localeCompare(b))]);
      })
      .catch(() => setSources(["all"]));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ window, min_score: String(minScore) });
    if (source !== "all") q.set("source", source);
    if (district !== "all") q.set("district", district);

    Promise.all([
      fetch(`${API_URL}/api/geo/districts?${q.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API_URL}/api/geo/hotspots?${q.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API_URL}/api/geo/summary?${q.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API_URL}/api/geo/cells?window=${window}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([d, h, s, c]) => {
      setRows(d?.rows || []);
      setHotspots(h?.rows || []);
      setSummary(s || null);
      setCells(c?.rows || []);
    });
  }, [window, minScore, source, district]);

  const districts = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.district))).sort((a, b) => a.localeCompare(b))], [rows]);

  const sortedRows = useMemo(() => {
    const x = [...rows];
    if (mode === "median_price") x.sort((a, b) => (a.median_price_per_sqm || 0) - (b.median_price_per_sqm || 0));
    else if (mode === "off_market") x.sort((a, b) => (b.average_off_market_score || 0) - (a.average_off_market_score || 0));
    else if (mode === "new_density") x.sort((a, b) => b.just_listed_count - a.just_listed_count);
    else if (mode === "price_drop") x.sort((a, b) => b.price_drop_count - a.price_drop_count);
    else if (mode === "yield") x.sort((a, b) => (b.average_deal_score || 0) - (a.average_deal_score || 0));
    else x.sort((a, b) => b.hotspot_score - a.hotspot_score);
    return x;
  }, [rows, mode]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Geo-Heatmap</h1>

      <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-6 text-sm">
        <div><label className="mb-1 block text-muted-foreground">Ansicht</label><select className="w-full rounded border bg-background px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value)}><option value="median_price">Medianpreis</option><option value="deal_density">Deal-Dichte</option><option value="new_density">Neue Listings</option><option value="off_market">Off-Market-Dichte</option><option value="price_drop">Preisnachlässe</option><option value="yield">Investment-Potenzial</option></select></div>
        <div><label className="mb-1 block text-muted-foreground">Zeitraum</label><select className="w-full rounded border bg-background px-2 py-1" value={window} onChange={(e) => setWindow(e.target.value)}><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option><option value="all">Gesamt</option></select></div>
        <div><label className="mb-1 block text-muted-foreground">Mindest-Score</label><input type="number" min={0} max={100} className="w-full rounded border bg-background px-2 py-1" value={minScore} onChange={(e) => setMinScore(Number(e.target.value || 0))} /></div>
        <div><label className="mb-1 block text-muted-foreground">Stadtteil</label><select className="w-full rounded border bg-background px-2 py-1" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label className="mb-1 block text-muted-foreground">Quelle</label><select className="w-full rounded border bg-background px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="mb-1 block text-muted-foreground">Ebene</label><div className="flex gap-2"><button className={`rounded border px-2 py-1 ${view==="district"?"bg-muted":""}`} onClick={() => setView("district")}>Stadtteile</button><button className={`rounded border px-2 py-1 ${view==="coordinate"?"bg-muted":""}`} onClick={() => setView("coordinate")}>Koordinaten</button></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border p-3">
          <h2 className="mb-2 text-sm font-medium">{view === "district" ? "Stadtteil-Überblick" : "Koordinatenzellen"}</h2>
          {view === "district" ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedRows.map((r) => (
                <div key={r.district} className="rounded border p-2 text-xs">
                  <p className="font-semibold">{r.district}</p>
                  <p>Median: {eur(r.median_price_per_sqm)}</p>
                  <p>Listings: {r.listing_count}</p>
                  <p>Top-Deals: {r.top_deal_count}</p>
                  <p>Ø Score: {r.average_deal_score ? Math.round(r.average_deal_score) : "-"}</p>
                  <p>Trend: {r.trend === "down" ? "↓" : r.trend === "up" ? "↑" : "→"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              {cells.slice(0, 40).map((c) => <p key={c.cell}>{c.cell} · listings {c.listing_count} · top deals {c.top_deal_count}</p>)}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-3 text-sm">
          <h2 className="mb-2 font-medium">Top-Hotspots</h2>
          <ol className="space-y-1 text-xs">
            {hotspots.slice(0, 5).map((h, idx) => <li key={h.district}>{idx + 1}. {h.district} (score {Math.round(h.hotspot_score)})</li>)}
          </ol>
          <div className="mt-3 rounded border p-2 text-xs text-muted-foreground">
            <p>Listings gesamt: {summary?.total_listings ?? 0}</p>
            <p>Stadtteile: {summary?.districts ?? 0}</p>
            <p>Top-Deals: {summary?.top_deals ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <h2 className="mb-2 text-sm font-medium">Stadtteil-Ranking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1">district</th>
                <th className="px-2 py-1">listings</th>
                <th className="px-2 py-1">median €/m²</th>
                <th className="px-2 py-1">avg deal score</th>
                <th className="px-2 py-1">top deals</th>
                <th className="px-2 py-1">off-market</th>
                <th className="px-2 py-1">just listed</th>
                <th className="px-2 py-1">hotspot score</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.district} className="border-b">
                  <td className="px-2 py-1">{r.district}</td>
                  <td className="px-2 py-1">{r.listing_count}</td>
                  <td className="px-2 py-1">{eur(r.median_price_per_sqm)}</td>
                  <td className="px-2 py-1">{r.average_deal_score ? Math.round(r.average_deal_score) : "-"}</td>
                  <td className="px-2 py-1">{r.top_deal_count}</td>
                  <td className="px-2 py-1">{r.average_off_market_score ? Math.round(r.average_off_market_score) : 0}</td>
                  <td className="px-2 py-1">{r.just_listed_count}</td>
                  <td className="px-2 py-1">{Math.round(r.hotspot_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
