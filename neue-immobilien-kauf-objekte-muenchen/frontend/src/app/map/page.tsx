"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import { API_URL, parseBadges } from "@/lib/api";

type DistrictMetric = {
  district: string;
  listing_count: number;
  median_price_per_sqm: number | null;
  average_deal_score: number | null;
  average_off_market_score: number | null;
  top_deal_count: number;
  just_listed_count: number;
  price_drop_count: number;
  hotspot_score: number;
};

type MarkerRow = {
  id: number;
  title?: string;
  district?: string;
  source: string;
  url: string;
  price_per_sqm?: number;
  deal_score?: number;
  off_market_score?: number;
  badges?: string;
  latitude?: number;
  longitude?: number;
};

const munichCenter: [number, number] = [48.137154, 11.576124];

function colorForMode(mode: string, m?: DistrictMetric) {
  if (!m) return "#9ca3af";
  if (mode === "median_price") {
    const v = m.median_price_per_sqm || 0;
    if (v <= 9000) return "#16a34a";
    if (v <= 11000) return "#f59e0b";
    return "#dc2626";
  }
  if (mode === "off_market") {
    const v = m.average_off_market_score || 0;
    if (v >= 75) return "#7c3aed";
    if (v >= 60) return "#a78bfa";
    return "#d1d5db";
  }
  if (mode === "new_density") return m.just_listed_count >= 5 ? "#2563eb" : "#93c5fd";
  if (mode === "price_drop") return m.price_drop_count >= 3 ? "#0ea5e9" : "#bae6fd";
  if (mode === "yield") return (m.average_deal_score || 0) >= 80 ? "#16a34a" : "#f59e0b";
  const v = m.hotspot_score || 0;
  if (v >= 75) return "#16a34a";
  if (v >= 50) return "#eab308";
  return "#ef4444";
}

function markerColor(r: MarkerRow) {
  const b = parseBadges(r.badges);
  if (b.includes("CHECK")) return "#dc2626";
  if ((r.off_market_score || 0) >= 72) return "#7c3aed";
  if ((r.deal_score || 0) >= 85) return "#16a34a";
  return "#2563eb";
}

export default function MapPage() {
  const [mode, setMode] = useState("deal_density");
  const [window, setWindow] = useState("30d");
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState("all");
  const [district, setDistrict] = useState("all");
  const [view, setView] = useState<"district" | "markers">("district");
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const [districtRows, setDistrictRows] = useState<DistrictMetric[]>([]);
  const [markerRows, setMarkerRows] = useState<MarkerRow[]>([]);

  useEffect(() => {
    fetch("/data/munich_districts.geojson", { cache: "no-store" })
      .then((r) => r.json())
      .then(setGeojson)
      .catch(() => setGeojson(null));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ window, min_score: String(minScore) });
    if (source !== "all") q.set("source", source);
    if (district !== "all") q.set("district", district);

    fetch(`${API_URL}/api/geo/districts?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => setDistrictRows(x?.rows || []));

    fetch(`${API_URL}/api/geo/listings?${q.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => setMarkerRows((x?.rows || []).filter((p: MarkerRow) => p.latitude != null && p.longitude != null)));
  }, [window, minScore, source, district]);

  const districts = useMemo(() => ["all", ...Array.from(new Set(districtRows.map((x) => x.district))).sort((a, b) => a.localeCompare(b))], [districtRows]);

  const metricByDistrict = useMemo(() => {
    const m = new Map<string, DistrictMetric>();
    districtRows.forEach((r) => m.set(r.district, r));
    return m;
  }, [districtRows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Munich Geo Map</h1>

      <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-6 text-sm">
        <div><label className="mb-1 block text-muted-foreground">Mode</label><select className="w-full rounded border px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value)}><option value="median_price">Median Price €/m²</option><option value="deal_density">Deal Score Density</option><option value="new_density">New Listings Density</option><option value="off_market">Off-Market Density</option><option value="price_drop">Price Drop Density</option><option value="yield">Investment Yield Potential</option><option value="markers">Raw Listing Markers</option></select></div>
        <div><label className="mb-1 block text-muted-foreground">Time range</label><select className="w-full rounded border px-2 py-1" value={window} onChange={(e) => setWindow(e.target.value)}><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option><option value="all">all</option></select></div>
        <div><label className="mb-1 block text-muted-foreground">Score</label><input type="number" min={0} max={100} className="w-full rounded border px-2 py-1" value={minScore} onChange={(e) => setMinScore(Number(e.target.value || 0))} /></div>
        <div><label className="mb-1 block text-muted-foreground">District</label><select className="w-full rounded border px-2 py-1" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label className="mb-1 block text-muted-foreground">Source</label><select className="w-full rounded border px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>{["all","sz","immowelt","ohne_makler","wohnungsboerse","sis","planethome"].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="mb-1 block text-muted-foreground">Layer</label><div className="flex gap-2"><button className={`rounded border px-2 py-1 ${view==="district"?"bg-muted":""}`} onClick={() => setView("district")}>district</button><button className={`rounded border px-2 py-1 ${view==="markers"?"bg-muted":""}`} onClick={() => setView("markers")}>markers</button></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border p-2">
          <MapContainer center={munichCenter} zoom={11} style={{ height: 560, width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {view === "district" && geojson ? (
              <GeoJSON
                data={geojson}
                style={(feature) => {
                  const name = String(feature?.properties?.name || "");
                  return {
                    color: "#374151",
                    weight: 1,
                    fillOpacity: 0.45,
                    fillColor: colorForMode(mode, metricByDistrict.get(name)),
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const name = String(feature?.properties?.name || "");
                  const m = metricByDistrict.get(name);
                  layer.bindTooltip(name);
                  layer.bindPopup(
                    `<strong>${name}</strong><br/>Listings: ${m?.listing_count ?? 0}<br/>Median €/m²: ${m?.median_price_per_sqm ?? "-"}<br/>Avg deal: ${Math.round(m?.average_deal_score ?? 0)}<br/>Top deals: ${m?.top_deal_count ?? 0}<br/>Off-market: ${Math.round(m?.average_off_market_score ?? 0)}<br/>Hotspot: ${Math.round(m?.hotspot_score ?? 0)}`
                  );
                }}
              />
            ) : null}

            {view === "markers" || mode === "markers"
              ? markerRows.slice(0, 1500).map((m) => (
                  <CircleMarker key={m.id} center={[m.latitude!, m.longitude!]} radius={5} pathOptions={{ color: markerColor(m), fillOpacity: 0.8 }}>
                    <Popup>
                      <div className="text-xs">
                        <p><strong>{m.title || "Listing"}</strong></p>
                        <p>{m.district || "München"} · {m.source}</p>
                        <p>Score {Math.round(m.deal_score || 0)} · Off-market {Math.round(m.off_market_score || 0)}</p>
                        <a href={m.url} target="_blank" rel="noreferrer">Open</a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              : null}
          </MapContainer>
        </div>

        <div className="rounded-xl border p-3 text-sm">
          <h2 className="mb-2 font-medium">Top Hotspots</h2>
          <ol className="space-y-1 text-xs">
            {[...districtRows].sort((a, b) => b.hotspot_score - a.hotspot_score).slice(0, 5).map((h, idx) => (
              <li key={h.district}>{idx + 1}. {h.district} ({Math.round(h.hotspot_score)})</li>
            ))}
          </ol>
          <h3 className="mt-4 mb-1 text-xs font-medium">District Ranking</h3>
          <div className="space-y-1 text-xs max-h-[360px] overflow-auto">
            {[...districtRows].sort((a, b) => b.hotspot_score - a.hotspot_score).map((r) => (
              <p key={r.district}>{r.district}: {r.listing_count} · {Math.round(r.hotspot_score)}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
