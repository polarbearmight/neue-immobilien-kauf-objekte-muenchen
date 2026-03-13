"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Analytics = {
  source_distribution: Array<{ source: string; count: number }>;
  price_bands: Array<{ band: string; count: number }>;
  district_stats: Array<{ district: string; count: number; avg_ppsqm: number | null }>;
};

type ScanCoverageRow = {
  source: string;
  status: string;
  raw_found?: number;
  normalized?: number;
  dropped_invalid?: number;
  dedupe_removed?: number;
  skipped_known?: number;
  new?: number;
  updated?: number;
  error?: string;
};

type ScanState = {
  running: boolean;
  started_at?: string | null;
  finished_at?: string | null;
  current_source?: string | null;
  completed_sources: number;
  total_sources: number;
  new_listings_count: number;
  updated_count: number;
  error_count: number;
  status: "idle" | "running" | "done" | "error" | string;
  coverage?: ScanCoverageRow[];
};

export default function DashboardPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [allDistrictOptions, setAllDistrictOptions] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | "">("");
  const [priceMax, setPriceMax] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("-");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const prevScanStatus = useRef<string | null>(null);
  const listingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ bucket, sort, limit: "500", min_score: String(minScore) });
        if (source !== "all") params.set("source", source);
        if (selectedDay) params.set("first_seen_date", selectedDay);
        if (selectedDistricts.length) params.set("districts", selectedDistricts.join(","));
        if (priceMin !== "") params.set("price_min", String(priceMin));
        if (priceMax !== "") params.set("price_max", String(priceMax));
        const [lRes, sRes, aRes] = await Promise.all([
          fetch(`${API_URL}/api/listings?${params.toString()}`, { cache: "no-store", signal: controller.signal }),
          fetch(`${API_URL}/api/stats?days=7`, { cache: "no-store", signal: controller.signal }),
          fetch(`${API_URL}/api/analytics?days=30`, { cache: "no-store", signal: controller.signal }),
        ]);
        if (!lRes.ok || !sRes.ok || !aRes.ok) throw new Error(`api_error_${lRes.status}_${sRes.status}_${aRes.status}`);

        const [lData, sData, aData] = await Promise.all([lRes.json(), sRes.json(), aRes.json()]);
        setItems(Array.isArray(lData) ? lData : []);
        setStats(sData || null);
        setAnalytics(aData || null);
        setLastUpdated(new Date().toLocaleTimeString("de-DE"));
      } catch {
        if (!controller.signal.aborted) {
          setError("Daten konnten nicht geladen werden. Bitte erneut versuchen.");
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [bucket, source, sort, selectedDistricts, minScore, priceMin, priceMax, selectedDay, refreshTick]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/scan/status`, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const next: ScanState | null = data?.scan || null;
        setScan(next);

        if (next?.status === "done" && prevScanStatus.current !== "done") {
          setScanNotice("Scan abgeschlossen");
          setRefreshTick((v) => v + 1);
          timer = setTimeout(() => setScanNotice(null), 2500);
        } else if (next?.status === "error" && prevScanStatus.current !== "error") {
          setScanNotice("Scan fehlgeschlagen");
        }
        prevScanStatus.current = next?.status || null;
      } catch {}
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      clearInterval(id);
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const startScan = async (kind: "major" | "secondary" | "all" = "major") => {
    setScanNotice(null);
    const endpoint = kind === "secondary" ? "/api/scan/run-secondary" : kind === "all" ? "/api/scan/run-all" : "/api/scan/run";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setScanNotice("Scan fehlgeschlagen");
        return;
      }
      setScan(data?.scan || null);
    } catch {
      setScanNotice("Scan fehlgeschlagen");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => `${x.title || ""} ${x.district || ""}`.toLowerCase().includes(q));
  }, [items, query]);

  const sources = useMemo(() => {
    const fromAnalytics = analytics?.source_distribution?.map((x) => x.source) || [];
    const unique = Array.from(new Set(fromAnalytics)).sort((a, b) => a.localeCompare(b));
    return ["all", ...unique];
  }, [analytics]);

  useEffect(() => {
    const controller = new AbortController();
    const loadDistricts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/districts`, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const raw: string[] = Array.isArray(data)
          ? data.map((x: { district?: string }) => x.district).filter((v): v is string => typeof v === "string" && v.length > 0)
          : [];
        const options = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
        setAllDistrictOptions(options);
      } catch {}
    };
    loadDistricts();
    return () => controller.abort();
  }, []);

  const districtOptions = useMemo(() => {
    if (allDistrictOptions.length) return allDistrictOptions;
    const items = analytics?.district_stats?.map((d) => d.district).filter(Boolean) || [];
    return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
  }, [analytics, allDistrictOptions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Kaufobjekte München · neueste zuerst · lokale Datenbank</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border bg-background px-2 py-1 text-xs" onClick={() => setRefreshTick((v) => v + 1)}>Aktualisieren</button>
          <button className="rounded border bg-background px-2 py-1 text-xs" onClick={() => startScan("major")} disabled={scan?.running} title="Große Portale">{scan?.running ? "Scan läuft…" : "Große Quellen scannen"}</button>
          <button className="rounded border bg-background px-2 py-1 text-xs" onClick={() => startScan("secondary")} disabled={scan?.running}>Sekundäre Quellen scannen</button>
          <a className="rounded border bg-background px-2 py-1 text-xs" href={`${API_URL}/api/export.csv`} target="_blank" rel="noreferrer">CSV exportieren</a>
        </div>
      </div>

      {scanNotice ? <div className="rounded-xl border px-3 py-2 text-sm">{scanNotice}</div> : null}
      {scan ? <div className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">Status: {scan.status} · Quelle: {scan.current_source || "-"} · {scan.completed_sources}/{scan.total_sources} · new {scan.new_listings_count} · updated {scan.updated_count} · errors {scan.error_count}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">Aktive Immobilien in der lokalen Datenbank: {items.length || 0} geladene Treffer · Live-Daten aus der aktuellen lokalen Immobilien-Datenbank.</div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Neue Listings</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.new_listings ?? 0}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Ø Preis / m²</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(stats?.avg_price_per_sqm)}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Top-Deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.top_deals ?? 0}</CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Aktive Quellen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sources.length - 1}</CardContent></Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Neue Listings · letzte 7 Tage</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.series?.length ? (
            <MiniBarChart
              data={stats.series.map((s) => ({ label: s.date, value: s.count }))}
              activeLabel={selectedDay}
              onBarClick={(point) => {
                setSelectedDay(point.label);
                setBucket("all");
                setSource("all");
                setSelectedDistricts([]);
                setMinScore(0);
                setPriceMin("");
                setPriceMax("");
                setQuery("");
                setSort("newest");
                requestAnimationFrame(() => {
                  listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          ) : <p className="text-sm text-muted-foreground">Keine Daten vorhanden.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <label className="text-sm">Bucket<select className="mt-1 w-full rounded border px-2 py-1" value={bucket} onChange={(e) => setBucket(e.target.value)}><option value="all">all</option><option value="top">top</option><option value="new">new</option><option value="price_drop">price_drop</option></select></label>
          <label className="text-sm">Quelle<select className="mt-1 w-full rounded border px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-sm">Sortierung<select className="mt-1 w-full rounded border px-2 py-1" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">newest</option><option value="price_asc">price_asc</option><option value="price_desc">price_desc</option><option value="score">score</option><option value="investment">investment</option></select></label>
          <label className="text-sm">Mindest-Score: {minScore}<input className="mt-1 w-full" type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label>
          <label className="text-sm">Preis min<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))} /></label>
          <label className="text-sm">Preis max<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))} /></label>
          <label className="text-sm md:col-span-2">Suche<input className="mt-1 w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel oder Stadtteil" /></label>
          <div className="text-sm md:col-span-8">
            <p className="mb-2 text-muted-foreground">Stadtteile</p>
            <div className="flex flex-wrap gap-2">{districtOptions.map((district) => {
              const active = selectedDistricts.includes(district);
              return <button key={district} className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setSelectedDistricts((prev) => active ? prev.filter((d) => d !== district) : [...prev, district])}>{district}</button>;
            })}</div>
          </div>
        </CardContent>
      </Card>

      <div ref={listingsRef} className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listings</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {selectedDay ? <span>Nur Einträge von {selectedDay} · andere Filter für diesen Drilldown zurückgesetzt</span> : null}
            <span>Treffer: {filtered.length}</span>
            <p>Letzte Aktualisierung: {lastUpdated}</p>
          </div>
        </div>
        <ListingTable rows={filtered} onDetails={(item) => setSelected(item)} />
      </div>

      <ListingDrawer listing={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
