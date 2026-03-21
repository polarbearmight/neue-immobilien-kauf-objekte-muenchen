"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { API_URL, authHeaders, parseBadges } from "@/lib/api";
import { StateCard } from "@/components/state-card";

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
  display_title?: string;
  district?: string;
  source: string;
  url: string;
  price_eur?: number;
  rooms?: number;
  area_sqm?: number;
  price_per_sqm?: number;
  deal_score?: number;
  off_market_score?: number;
  badges?: string;
  latitude?: number;
  longitude?: number;
};

type GeoJsonFeature = {
  properties?: { name?: string };
};

type GeoJsonLike = {
  type: string;
  features?: GeoJsonFeature[];
};

type LeafletLayer = {
  bindTooltip: (text: string) => void;
  bindPopup: (html: string) => void;
  on: (eventName: string, handler: () => void) => void;
};

const munichCenter: [number, number] = [48.137154, 11.576124];

type LeafletComponentProps = Record<string, unknown>;

type ViewMode = "district" | "markers";
type MetricMode = "deal_density" | "median_price" | "new_density" | "off_market" | "price_drop" | "yield";

const LMapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false }) as unknown as ComponentType<LeafletComponentProps>;
const LTileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false }) as unknown as ComponentType<LeafletComponentProps>;
const LGeoJSON = dynamic(() => import("react-leaflet").then((m) => m.GeoJSON), { ssr: false }) as unknown as ComponentType<LeafletComponentProps>;
const LCircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false }) as unknown as ComponentType<LeafletComponentProps>;
const LPopup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false }) as unknown as ComponentType<LeafletComponentProps>;

function colorForMode(mode: MetricMode, m?: DistrictMetric) {
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
  const [metricMode, setMetricMode] = useState<MetricMode>("deal_density");
  const [windowRange, setWindowRange] = useState("30d");
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState("all");
  const [district, setDistrict] = useState("all");
  const [view, setView] = useState<ViewMode>("district");
  const [geojson, setGeojson] = useState<GeoJsonLike | null>(null);
  const [districtRows, setDistrictRows] = useState<DistrictMetric[]>([]);
  const [markerRows, setMarkerRows] = useState<MarkerRow[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerRow | null>(null);
  const [selectedDistrictListings, setSelectedDistrictListings] = useState<MarkerRow[]>([]);
  const [sources, setSources] = useState<string[]>(["all"]);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingMarkers, setLoadingMarkers] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/sources`, { cache: "no-store", headers: authHeaders() })
      .then((r) => r.json())
      .then((rows) => {
        const dynamicSources = Array.isArray(rows) ? rows.map((x: { name?: string }) => x.name).filter((v): v is string => Boolean(v)) : [];
        setSources(["all", ...Array.from(new Set(dynamicSources)).sort((a, b) => a.localeCompare(b))]);
      })
      .catch(() => setSources(["all"]));
  }, []);

  useEffect(() => {
    fetch("/data/munich_districts.geojson", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: GeoJsonLike) => setGeojson(data))
      .catch(() => setGeojson(null));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ window: windowRange, min_score: String(minScore) });
    if (source !== "all") q.set("source", source);
    if (district !== "all") q.set("district", district);

    const loadingTimer = window.setTimeout(() => {
      setMapError(null);
      setLoadingDistricts(true);
      setLoadingMarkers(true);
    }, 0);

    fetch(`${API_URL}/api/geo/districts?${q.toString()}`, { cache: "no-store", headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("districts_failed");
        return r.json();
      })
      .then((x) => setDistrictRows(x?.rows || []))
      .catch(() => {
        setDistrictRows([]);
        setMapError("Kartendaten konnten nicht vollständig geladen werden.");
      })
      .finally(() => setLoadingDistricts(false));

    fetch(`${API_URL}/api/geo/listings?${q.toString()}`, { cache: "no-store", headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("markers_failed");
        return r.json();
      })
      .then((x) => setMarkerRows((x?.rows || []).filter((p: MarkerRow) => p.latitude != null && p.longitude != null)))
      .catch(() => {
        setMarkerRows([]);
        setMapError("Kartendaten konnten nicht vollständig geladen werden.");
      })
      .finally(() => setLoadingMarkers(false));

    return () => window.clearTimeout(loadingTimer);
  }, [windowRange, minScore, source, district]);

  useEffect(() => {
    const activeDistrict = selectedDistrict || (district !== "all" ? district : null);
    if (!activeDistrict) return;
    const q = new URLSearchParams({ window: windowRange, min_score: String(minScore), district: activeDistrict, limit: "200" });
    if (source !== "all") q.set("source", source);
    fetch(`${API_URL}/api/geo/listings?${q.toString()}`, { cache: "no-store", headers: authHeaders() })
      .then((r) => r.json())
      .then((x) => setSelectedDistrictListings(x?.rows || []))
      .catch(() => setSelectedDistrictListings([]));
  }, [selectedDistrict, district, windowRange, minScore, source]);

  useEffect(() => {
    if (selectedDistrict || district !== "all") return;
    const resetTimer = window.setTimeout(() => setSelectedDistrictListings([]), 0);
    return () => window.clearTimeout(resetTimer);
  }, [selectedDistrict, district]);

  const districts = useMemo(
    () => ["all", ...Array.from(new Set(districtRows.map((x) => x.district))).sort((a, b) => a.localeCompare(b))],
    [districtRows]
  );

  const metricByDistrict = useMemo(() => {
    const m = new Map<string, DistrictMetric>();
    districtRows.forEach((r) => m.set(r.district, r));
    return m;
  }, [districtRows]);

  const citySummary = useMemo(() => {
    const listingCount = districtRows.reduce((s, r) => s + (r.listing_count || 0), 0);
    const medianAvg = districtRows.length ? districtRows.reduce((s, r) => s + (r.median_price_per_sqm || 0), 0) / districtRows.length : 0;
    const avgDeal = districtRows.length ? districtRows.reduce((s, r) => s + (r.average_deal_score || 0), 0) / districtRows.length : 0;
    return { listingCount, medianAvg, avgDeal };
  }, [districtRows]);

  const selectedDistrictMetric = selectedDistrict ? metricByDistrict.get(selectedDistrict) : null;
  const topHotspots = useMemo(() => [...districtRows].sort((a, b) => b.hotspot_score - a.hotspot_score).slice(0, 5), [districtRows]);
  const activeMapHeight = view === "markers" ? "clamp(420px, 68vh, 760px)" : "clamp(420px, 64vh, 720px)";
  const showingMarkers = view === "markers";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kartenansicht München</h1>
          <p className="text-sm text-muted-foreground">Zwischen Stadtteil-Layer und konkreten Listings wechseln, ohne die Filter zu verlieren.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">{districtRows.length} Stadtteile</span>
          <span className="rounded-full border px-3 py-1">{markerRows.length} Marker</span>
          <span className="rounded-full border px-3 py-1">{loadingDistricts || loadingMarkers ? "aktualisiert…" : windowRange}</span>
        </div>
      </div>

      {mapError ? <StateCard title="Karte teilweise unvollständig" body={mapError} tone="error" /> : null}

      <div className="grid gap-3 rounded-3xl border p-3 text-sm md:grid-cols-6">
        <div>
          <label className="mb-1 block text-muted-foreground">Ebene</label>
          <div className="flex gap-2">
            <button className={`rounded-xl border px-3 py-2 ${view === "district" ? "bg-muted" : ""}`} onClick={() => setView("district")}>Stadtteile</button>
            <button className={`rounded-xl border px-3 py-2 ${view === "markers" ? "bg-muted" : ""}`} onClick={() => setView("markers")}>Marker</button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-muted-foreground">Stadtteil-Metrik</label>
          <select className="w-full rounded-xl border bg-background px-3 py-2" value={metricMode} onChange={(e) => setMetricMode(e.target.value as MetricMode)} disabled={showingMarkers}>
            <option value="median_price">Medianpreis €/m²</option>
            <option value="deal_density">Deal-Dichte</option>
            <option value="new_density">Neue Listings</option>
            <option value="off_market">Off-Market-Dichte</option>
            <option value="price_drop">Preisnachlässe</option>
            <option value="yield">Investment-Potenzial</option>
          </select>
        </div>
        <div><label className="mb-1 block text-muted-foreground">Zeitraum</label><select className="w-full rounded-xl border bg-background px-3 py-2" value={windowRange} onChange={(e) => setWindowRange(e.target.value)}><option value="24h">24h</option><option value="7d">7d</option><option value="30d">30d</option><option value="all">Gesamt</option></select></div>
        <div><label className="mb-1 block text-muted-foreground">Mindest-Score</label><input type="number" min={0} max={100} className="w-full rounded-xl border bg-background px-3 py-2" value={minScore} onChange={(e) => setMinScore(Number(e.target.value || 0))} /></div>
        <div><label className="mb-1 block text-muted-foreground">Stadtteil</label><select className="w-full rounded-xl border bg-background px-3 py-2" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
        <div><label className="mb-1 block text-muted-foreground">Quelle</label><select className="w-full rounded-xl border bg-background px-3 py-2" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className="md:col-span-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-muted-foreground">
          <span>{loadingDistricts || loadingMarkers ? "Daten werden aktualisiert…" : showingMarkers ? "Markeransicht aktiv" : `Stadtteil-Layer · ${metricMode.replace("_", " ")}`}</span>
          <button className="rounded-xl border px-3 py-2 text-xs" onClick={() => { setMetricMode("deal_density"); setWindowRange("30d"); setMinScore(0); setSource("all"); setDistrict("all"); setView("district"); setSelectedDistrict(null); setSelectedMarker(null); }}>Ansicht zurücksetzen</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border p-2">
          <LMapContainer center={munichCenter} zoom={11} style={{ height: activeMapHeight, width: "100%" }}>
            <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {view === "district" && geojson ? (
              <LGeoJSON
                data={geojson}
                style={(feature: GeoJsonFeature) => {
                  const name = String(feature?.properties?.name || "");
                  return {
                    color: "#374151",
                    weight: 1,
                    fillOpacity: 0.45,
                    fillColor: colorForMode(metricMode, metricByDistrict.get(name)),
                  };
                }}
                onEachFeature={(feature: GeoJsonFeature, layer: LeafletLayer) => {
                  const name = String(feature?.properties?.name || "");
                  const m = metricByDistrict.get(name);
                  layer.bindTooltip(name);
                  layer.bindPopup(
                    `<strong>${name}</strong><br/>Listings: ${m?.listing_count ?? 0}<br/>Median €/m²: ${m?.median_price_per_sqm ?? "-"}<br/>Ø Score: ${Math.round(m?.average_deal_score ?? 0)}<br/>Top-Deals: ${m?.top_deal_count ?? 0}<br/>Off-Market: ${Math.round(m?.average_off_market_score ?? 0)}<br/>Hotspot: ${Math.round(m?.hotspot_score ?? 0)}`
                  );
                  layer.on("click", () => {
                    setSelectedDistrict(name);
                    setDistrict(name);
                    setSelectedMarker(null);
                  });
                }}
              />
            ) : null}

            {showingMarkers
              ? markerRows.slice(0, 1500).map((m) => (
                  <LCircleMarker key={m.id} center={[m.latitude!, m.longitude!]} radius={5} pathOptions={{ color: markerColor(m), fillOpacity: 0.8 }} eventHandlers={{ click: () => { setSelectedMarker(m); setSelectedDistrict(m.district || null); } }}>
                    <LPopup>
                      <div className="text-xs">
                        <p><strong>{m.display_title || m.title || "Listing"}</strong></p>
                        <p>{m.district || "München"} · {m.source}</p>
                        <p>Score {Math.round(m.deal_score || 0)} · Off-market {Math.round(m.off_market_score || 0)}</p>
                        <a href={m.url} target="_blank" rel="noreferrer">Open</a>
                      </div>
                    </LPopup>
                  </LCircleMarker>
                ))
              : null}
          </LMapContainer>
        </div>

        <div className="rounded-3xl border p-3 text-sm">
          <h2 className="mb-2 font-medium">Geo Intelligence</h2>
          {selectedMarker ? (
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Ausgewähltes Listing</p>
              <p>{selectedMarker.display_title || selectedMarker.title || "Listing"}</p>
              <p>{selectedMarker.district || "München"} · {selectedMarker.source}</p>
              <p>Preis: {selectedMarker.price_eur ? `${Math.round(selectedMarker.price_eur).toLocaleString("de-DE")} €` : "-"}</p>
              <p>Größe: {selectedMarker.area_sqm || "-"} m² · Zimmer: {selectedMarker.rooms || "-"}</p>
              <p>€/m²: {selectedMarker.price_per_sqm ? Math.round(selectedMarker.price_per_sqm) : "-"}</p>
              <p>Deal {Math.round(selectedMarker.deal_score || 0)} · Off-market {Math.round(selectedMarker.off_market_score || 0)}</p>
              <a className="inline-block rounded-xl border px-2 py-1" href={selectedMarker.url} target="_blank" rel="noreferrer">Listing öffnen</a>
            </div>
          ) : selectedDistrict && selectedDistrictMetric ? (
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Stadtteil: {selectedDistrict}</p>
              <p>Listings: {selectedDistrictMetric.listing_count}</p>
              <p>Median €/m²: {selectedDistrictMetric.median_price_per_sqm ? Math.round(selectedDistrictMetric.median_price_per_sqm).toLocaleString("de-DE") : "-"}</p>
              <p>Ø Score: {selectedDistrictMetric.average_deal_score ? Math.round(selectedDistrictMetric.average_deal_score) : "-"}</p>
              <p>Top-Deals: {selectedDistrictMetric.top_deal_count}</p>
              <p>Off-Market: {selectedDistrictMetric.average_off_market_score ? Math.round(selectedDistrictMetric.average_off_market_score) : 0}</p>
              <p>Preisnachlässe: {selectedDistrictMetric.price_drop_count}</p>
              <p>Neu gelistet: {selectedDistrictMetric.just_listed_count}</p>
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Stadtweite Übersicht</p>
              <p>Aktive Listings: {citySummary.listingCount}</p>
              <p>Median €/m² (Stadtteil-Ø): {Math.round(citySummary.medianAvg || 0).toLocaleString("de-DE")}</p>
              <p>Ø Deal-Score: {Math.round(citySummary.avgDeal || 0)}</p>
            </div>
          )}

          <h3 className="mb-1 mt-4 text-xs font-medium">Top-Hotspots</h3>
          <ol className="space-y-1 text-xs">
            {topHotspots.map((h, idx) => (
              <li key={h.district}>{idx + 1}. {h.district} ({Math.round(h.hotspot_score)})</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border p-3">
          <h3 className="mb-2 text-sm font-medium">Stadtteil-Ranking</h3>
          {loadingDistricts ? (
            <StateCard title="Ranking wird geladen" body="Die Stadtteilmetriken werden aktualisiert." tone="muted" />
          ) : districtRows.length === 0 ? (
            <StateCard title="Keine Stadtteildaten" body="Mit den aktuellen Filtern wurden keine Stadtteilmetriken gefunden." tone="muted" />
          ) : (
            <div className="space-y-1 text-xs max-h-[280px] overflow-auto">
              {[...districtRows].sort((a, b) => b.hotspot_score - a.hotspot_score).map((r) => (
                <button key={r.district} className="block w-full rounded-xl border px-2 py-2 text-left hover:bg-muted/40" onClick={() => { setSelectedDistrict(r.district); setDistrict(r.district); setSelectedMarker(null); }}>
                  {r.district}: {r.listing_count} · hotspot {Math.round(r.hotspot_score)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border p-3">
          <h3 className="mb-2 text-sm font-medium">Listings im gewählten Bereich</h3>
          <div className="space-y-1 text-xs max-h-[280px] overflow-auto">
            {selectedDistrictListings.slice(0, 10).map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="block rounded-xl border px-2 py-2 hover:bg-muted/40">
                <p className="font-medium">{l.display_title || l.title || "Listing"}</p>
                <p>{l.district || "München"} · {l.source}</p>
                <p>€/m² {l.price_per_sqm ? Math.round(l.price_per_sqm) : "-"} · Score {Math.round(l.deal_score || 0)}</p>
              </a>
            ))}
            {!selectedDistrictListings.length ? <p className="text-muted-foreground">Wähle einen Stadtteil auf der Karte oder im Ranking.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
