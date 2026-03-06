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
};

export default function Page() {
  const [items, setItems] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("newest");
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
  }, [bucket, source, sort, minScore, priceMin, priceMax, refreshTick]);

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

  const startScan = async () => {
    setScanNotice(null);
    try {
      const res = await fetch(`${API_URL}/api/scan/run`, { method: "POST" });
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
            onClick={startScan}
            disabled={scan?.running}
          >
            {scan?.running ? "Scanning..." : scan?.status === "done" ? "Scan Complete" : scan?.status === "error" ? "Scan Failed" : "Scan Sources"}
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
      <ListingDrawer listing={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
