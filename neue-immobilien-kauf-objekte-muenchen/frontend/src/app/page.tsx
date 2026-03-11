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

export default function Page() {
  const [items, setItems] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [allDistrictOptions, setAllDistrictOptions] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(0);
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

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ bucket, sort, limit: "500", min_score: String(minScore) });
        if (source !== "all") params.set("source", source);
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
  }, [bucket, source, sort, selectedDistricts, minScore, priceMin, priceMax, refreshTick]);

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
          setScanNotice("Scan Complete");
          setRefreshTick((v) => v + 1);
          timer = setTimeout(() => setScanNotice(null), 2500);
        } else if (next?.status === "error" && prevScanStatus.current !== "error") {
          setScanNotice("Scan Failed");
        }
        prevScanStatus.current = next?.status || null;
      } catch {
        // ignore scan polling errors
      }
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
        setScanNotice("Scan Failed");
        return;
      }
      setScan(data?.scan || null);
    } catch {
      setScanNotice("Scan Failed");
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
          ? data
              .map((x: { district?: string }) => x.district)
              .filter((v): v is string => typeof v === "string" && v.length > 0)
          : [];
        const options = Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
        setAllDistrictOptions(options);
      } catch {
        // ignore district option fetch errors
      }
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
          <p className="text-sm text-muted-foreground">Deal Finder · neueste zuerst · lokale Datenbank</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-xs" onClick={() => setRefreshTick((v) => v + 1)}>
            Refresh
          </button>
          <button
            className="rounded border px-2 py-1 text-xs"
            onClick={() => startScan("major")}
            disabled={scan?.running}
            title="Primary portals"
          >
            {scan?.running ? "Scanning..." : "Scan Major"}
          </button>
          <button
            className="rounded border px-2 py-1 text-xs"
            onClick={() => startScan("secondary")}
            disabled={scan?.running}
            title="Broker + classifieds + auctions"
          >
            Scan Secondary
          </button>
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

      {scan ? (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-4">Source: {scan.current_source || "-"}</span>
          <span className="mr-4">Progress: {scan.completed_sources}/{scan.total_sources}</span>
          <span className="mr-4">New: {scan.new_listings_count}</span>
          <span className="mr-4">Updated: {scan.updated_count}</span>
          <span>Errors: {scan.error_count}</span>
        </div>
      ) : null}

      {scanNotice ? <p className="text-xs text-green-700">{scanNotice}</p> : null}

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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Source Distribution (30d)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(analytics?.source_distribution || []).slice(0, 6).map((s) => <p key={s.source}>{s.source}: {s.count}</p>)}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Price Bands</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(analytics?.price_bands || []).map((b) => <p key={b.band}>{b.band}: {b.count}</p>)}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Top Districts</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(analytics?.district_stats || []).slice(0, 5).map((d) => <p key={d.district}>{d.district}: {d.count} · {eur(d.avg_ppsqm)}</p>)}
          </CardContent>
        </Card>
      </div>

      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

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
              <label className="mb-1 block text-muted-foreground">Source</label>
              <select className="w-full rounded-md border px-3 py-2" value={source} onChange={(e) => setSource(e.target.value)}>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-muted-foreground">Districts (multi)</label>
                <button className="rounded border px-2 py-0.5 text-[11px]" onClick={() => setSelectedDistricts([])}>
                  Alle anzeigen
                </button>
              </div>
              <select
                className="h-32 w-full rounded-md border px-2 py-2"
                multiple
                value={selectedDistricts}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setSelectedDistricts(values);
                }}
              >
                {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-muted-foreground">Gesamtpreis (€)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-md border px-3 py-2"
                  type="number"
                  min={0}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Min"
                />
                <input
                  className="w-full rounded-md border px-3 py-2"
                  type="number"
                  min={0}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Max"
                />
              </div>
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

      {scan?.coverage?.length ? (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-sm">Scan Coverage</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-1">Source</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Raw</th>
                    <th className="px-2 py-1">Normalized</th>
                    <th className="px-2 py-1">Dropped</th>
                    <th className="px-2 py-1">Dedupe</th>
                    <th className="px-2 py-1">Known</th>
                    <th className="px-2 py-1">New</th>
                    <th className="px-2 py-1">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.coverage.map((r) => {
                    const raw = r.raw_found || 0;
                    const dropped = r.dropped_invalid || 0;
                    const warn = raw >= 10 && dropped / Math.max(1, raw) > 0.5;
                    return (
                      <tr key={r.source} className={`border-b ${warn ? "bg-amber-50" : ""}`}>
                        <td className="px-2 py-1">{r.source}</td>
                        <td className="px-2 py-1">{r.status}</td>
                        <td className="px-2 py-1">{r.raw_found ?? "-"}</td>
                        <td className="px-2 py-1">{r.normalized ?? "-"}</td>
                        <td className="px-2 py-1">{r.dropped_invalid ?? "-"}</td>
                        <td className="px-2 py-1">{r.dedupe_removed ?? "-"}</td>
                        <td className="px-2 py-1">{r.skipped_known ?? "-"}</td>
                        <td className="px-2 py-1">{r.new ?? "-"}</td>
                        <td className="px-2 py-1">{r.updated ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <ListingDrawer listing={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
