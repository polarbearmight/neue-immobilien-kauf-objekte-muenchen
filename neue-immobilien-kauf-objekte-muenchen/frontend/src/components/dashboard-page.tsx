"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL, Listing } from "@/lib/api";
import { ListingDrawer } from "@/components/listing-drawer";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { ListingTable } from "@/components/listing-table";
import { OnboardingCard } from "@/components/onboarding-card";
import { StateCard } from "@/components/state-card";
import { MobileListingCards } from "@/components/mobile-listing-cards";
import { MobileFilterSheet } from "@/components/mobile-filter-sheet";
import { MobileStickyActions } from "@/components/mobile-sticky-actions";
import { MobileKpiSwitcher } from "@/components/mobile-kpi-switcher";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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

type FilterState = {
  source: string;
  sort: string;
  selectedDistricts: string[];
  minScore: number;
  priceMin: number | "";
  priceMax: number | "";
};

const defaultFilters = (): FilterState => ({
  source: "all",
  sort: "newest",
  selectedDistricts: [],
  minScore: 0,
  priceMin: "",
  priceMax: "",
});

export default function DashboardPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [allDistrictOptions, setAllDistrictOptions] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("-");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileKpiMode, setMobileKpiMode] = useState<"market" | "deals" | "sources">("market");
  const prevScanStatus = useRef<string | null>(null);
  const prevScanSignature = useRef<string | null>(null);
  const listingsRef = useRef<HTMLDivElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { source, sort, selectedDistricts, minScore, priceMin, priceMax } = appliedFilters;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const isInitialLoad = items.length === 0 && !stats && !analytics;
      if (isInitialLoad) setLoading(true);
      else setIsFetching(true);
      setError(null);
      try {
        const params = new URLSearchParams({ sort, limit: "500", min_score: String(minScore) });
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
        if (!controller.signal.aborted) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    };
    load();
    return () => controller.abort();
  }, [source, sort, selectedDistricts, minScore, priceMin, priceMax, selectedDay, refreshTick]);

  useEffect(() => {
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    let nextPollTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const poll = async () => {
      const controller = new AbortController();
      try {
        const res = await fetch(`${API_URL}/api/scan/status`, { cache: "no-store", signal: controller.signal });
        if (!res.ok || stopped) return;
        const data = await res.json();
        const next: ScanState | null = data?.scan || null;
        const signature = JSON.stringify(next || null);
        if (signature !== prevScanSignature.current) {
          setScan(next);
          prevScanSignature.current = signature;
        }

        if (next?.status === "done" && prevScanStatus.current !== "done") {
          setScanNotice("Scan abgeschlossen");
          setRefreshTick((v) => v + 1);
          noticeTimer = setTimeout(() => setScanNotice(null), 2500);
        } else if (next?.status === "error" && prevScanStatus.current !== "error") {
          setScanNotice("Scan fehlgeschlagen");
        }
        prevScanStatus.current = next?.status || null;

        const delay = next?.running ? 2000 : 15000;
        if (!stopped) nextPollTimer = setTimeout(poll, delay);
      } catch {
        if (!stopped) nextPollTimer = setTimeout(poll, 15000);
      }
    };

    poll();
    return () => {
      stopped = true;
      if (nextPollTimer) clearTimeout(nextPollTimer);
      if (noticeTimer) clearTimeout(noticeTimer);
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
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => `${x.title || ""} ${x.district || ""}`.toLowerCase().includes(q));
  }, [items, debouncedQuery]);

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

  const hasPendingFilterChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  }, [draftFilters, appliedFilters]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({
      source: draftFilters.source,
      sort: draftFilters.sort,
      selectedDistricts: [...draftFilters.selectedDistricts],
      minScore: draftFilters.minScore,
      priceMin: draftFilters.priceMin,
      priceMax: draftFilters.priceMax,
    });
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    const next = defaultFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
    setSelectedDay(null);
    setQuery("");
  }, []);

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-0">
      <OnboardingCard />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Kaufobjekte München · neueste zuerst · lokale Datenbank</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button className="min-h-11 rounded-xl border bg-background px-4 py-2 text-sm" onClick={() => setRefreshTick((v) => v + 1)}>Aktualisieren</button>
          <button className="min-h-11 rounded-xl border bg-background px-4 py-2 text-sm" onClick={resetFilters}>Filter zurücksetzen</button>
          <button className="min-h-11 rounded-xl border bg-background px-4 py-2 text-sm" onClick={() => startScan("major")} disabled={scan?.running} title="Große Portale">{scan?.running ? "Scan läuft…" : "Große Quellen scannen"}</button>
          <button className="col-span-2 min-h-11 rounded-xl border bg-background px-4 py-2 text-sm sm:col-span-1" onClick={() => startScan("secondary")} disabled={scan?.running}>Sekundäre Quellen scannen</button>
          <a className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border bg-background px-4 py-2 text-sm sm:col-span-1" href={`${API_URL}/api/export.csv?sort=${encodeURIComponent(sort)}&min_score=${encodeURIComponent(String(minScore))}${source !== "all" ? `&source=${encodeURIComponent(source)}` : ""}${selectedDay ? `&first_seen_date=${encodeURIComponent(selectedDay)}` : ""}${selectedDistricts.length ? `&districts=${encodeURIComponent(selectedDistricts.join(","))}` : ""}${priceMin !== "" ? `&price_min=${encodeURIComponent(String(priceMin))}` : ""}${priceMax !== "" ? `&price_max=${encodeURIComponent(String(priceMax))}` : ""}`} target="_blank" rel="noreferrer">CSV exportieren</a>
        </div>
      </div>

      {scanNotice ? <div className="rounded-xl border px-3 py-2 text-sm">{scanNotice}</div> : null}
      {scan ? <div className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">Status: {scan.status} · Quelle: {scan.current_source || "-"} · {scan.completed_sources}/{scan.total_sources} · new {scan.new_listings_count} · updated {scan.updated_count} · errors {scan.error_count}</div> : null}
      {isFetching && !loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Filter werden aktualisiert…</div> : null}
      {error ? <StateCard title="Daten konnten nicht geladen werden" body="Die API hat gerade keine vollständige Antwort geliefert. Bitte aktualisieren oder den Scan erneut starten." tone="error" action={<button className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm" onClick={() => setRefreshTick((v) => v + 1)}>Erneut laden</button>} /> : null}

      <div className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">Aktive Immobilien in der lokalen Datenbank: {items.length || 0} geladene Treffer · Live-Daten aus der aktuellen lokalen Immobilien-Datenbank.</div>

      <MobileKpiSwitcher active={mobileKpiMode} setActive={setMobileKpiMode} />
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl border bg-muted/40" />)}
        </div>
      ) : (
      <>
        <div className="grid gap-3 md:hidden">
          {mobileKpiMode === "market" ? <>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Neue Listings</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.new_listings ?? 0}</CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Ø Preis / m²</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(stats?.avg_price_per_sqm)}</CardContent></Card>
          </> : mobileKpiMode === "deals" ? <>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Top-Deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.top_deals ?? 0}</CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Treffer aktuell</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{filtered.length}</CardContent></Card>
          </> : <>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Aktive Quellen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sources.length - 1}</CardContent></Card>
            <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader><CardContent className="text-base font-semibold">{scan?.status || "idle"}</CardContent></Card>
          </>}
        </div>
        <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Neue Listings</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.new_listings ?? 0}</CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Ø Preis / m²</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(stats?.avg_price_per_sqm)}</CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Top-Deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats?.top_deals ?? 0}</CardContent></Card>
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-sm">Aktive Quellen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sources.length - 1}</CardContent></Card>
        </div>
      </>
      )}

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
                const next = defaultFilters();
                setDraftFilters(next);
                setAppliedFilters(next);
                setQuery("");
                requestAnimationFrame(() => {
                  listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            />
          ) : <p className="text-sm text-muted-foreground">Keine Daten vorhanden.</p>}
        </CardContent>
      </Card>

      <Card className="hidden rounded-2xl md:block">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <label className="text-sm">Quelle<select className="mt-1 w-full rounded border px-2 py-1" value={draftFilters.source} onChange={(e) => setDraftFilters((prev) => ({ ...prev, source: e.target.value }))}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-sm">Sortierung<select className="mt-1 w-full rounded border px-2 py-1" value={draftFilters.sort} onChange={(e) => setDraftFilters((prev) => ({ ...prev, sort: e.target.value }))}><option value="newest">newest</option><option value="score">score</option><option value="investment">investment</option></select></label>
          <label className="text-sm">Mindest-Score: {draftFilters.minScore}<input className="mt-1 w-full" type="range" min={0} max={100} value={draftFilters.minScore} onChange={(e) => setDraftFilters((prev) => ({ ...prev, minScore: Number(e.target.value) }))} /></label>
          <label className="text-sm">Preis min<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={draftFilters.priceMin} onChange={(e) => setDraftFilters((prev) => ({ ...prev, priceMin: e.target.value === "" ? "" : Number(e.target.value) }))} /></label>
          <label className="text-sm">Preis max<input className="mt-1 w-full rounded border px-2 py-1" type="number" value={draftFilters.priceMax} onChange={(e) => setDraftFilters((prev) => ({ ...prev, priceMax: e.target.value === "" ? "" : Number(e.target.value) }))} /></label>
          <label className="text-sm md:col-span-2">Suche<input className="mt-1 w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel oder Stadtteil" /></label>
          <div className="text-sm md:col-span-7">
            <p className="mb-2 text-muted-foreground">Stadtteile</p>
            <div className="flex flex-wrap gap-2">{districtOptions.map((district) => {
              const active = draftFilters.selectedDistricts.includes(district);
              return <button key={district} className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setDraftFilters((prev) => ({ ...prev, selectedDistricts: active ? prev.selectedDistricts.filter((d) => d !== district) : [...prev.selectedDistricts, district] }))}>{district}</button>;
            })}</div>
          </div>
          <div className="md:col-span-7 flex items-center gap-2">
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={applyFilters} disabled={!hasPendingFilterChanges}>Filter anwenden</button>
            {hasPendingFilterChanges ? <span className="text-xs text-slate-500">Nicht angewendete Änderungen</span> : null}
          </div>
        </CardContent>
      </Card>

      <div ref={listingsRef} className="space-y-3 overflow-hidden">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold">Listings</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {selectedDay ? <span>Nur Einträge von {selectedDay} · andere Filter für diesen Drilldown zurückgesetzt</span> : null}
            <span>Treffer: {filtered.length}</span>
            <p>Letzte Aktualisierung: {lastUpdated}</p>
          </div>
        </div>
        {loading ? <StateCard title="Listings werden geladen" body="Die neuesten Immobilien und Kennzahlen werden gerade aus der lokalen Datenbank geladen." tone="muted" /> : <>
          <MobileListingCards rows={filtered} onDetails={(item) => setSelected(item)} />
          <div className="hidden md:block"><ListingTable rows={filtered} onDetails={(item) => setSelected(item)} /></div>
        </>}
      </div>

      <MobileStickyActions onOpenFilters={() => setMobileFiltersOpen(true)} onRefresh={() => setRefreshTick((v) => v + 1)} resultCount={filtered.length} />
      <MobileFilterSheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}>
        <div className="grid gap-4">
          <label className="text-sm">Quelle<select className="mt-1 w-full rounded-xl border px-3 py-3" value={draftFilters.source} onChange={(e) => setDraftFilters((prev) => ({ ...prev, source: e.target.value }))}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="text-sm">Sortierung<select className="mt-1 w-full rounded-xl border px-3 py-3" value={draftFilters.sort} onChange={(e) => setDraftFilters((prev) => ({ ...prev, sort: e.target.value }))}><option value="newest">newest</option><option value="score">score</option><option value="investment">investment</option></select></label>
          <label className="text-sm">Mindest-Score: {draftFilters.minScore}<input className="mt-2 w-full" type="range" min={0} max={100} value={draftFilters.minScore} onChange={(e) => setDraftFilters((prev) => ({ ...prev, minScore: Number(e.target.value) }))} /></label>
          <label className="text-sm">Preis min<input className="mt-1 w-full rounded-xl border px-3 py-3" type="number" value={draftFilters.priceMin} onChange={(e) => setDraftFilters((prev) => ({ ...prev, priceMin: e.target.value === "" ? "" : Number(e.target.value) }))} /></label>
          <label className="text-sm">Preis max<input className="mt-1 w-full rounded-xl border px-3 py-3" type="number" value={draftFilters.priceMax} onChange={(e) => setDraftFilters((prev) => ({ ...prev, priceMax: e.target.value === "" ? "" : Number(e.target.value) }))} /></label>
          <label className="text-sm">Suche<input className="mt-1 w-full rounded-xl border px-3 py-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel oder Stadtteil" /></label>
          <div className="text-sm">
            <p className="mb-2 text-muted-foreground">Stadtteile</p>
            <div className="flex flex-wrap gap-2">{districtOptions.map((district) => {
              const active = draftFilters.selectedDistricts.includes(district);
              return <button key={district} className={`rounded-full border px-3 py-2 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-background"}`} onClick={() => setDraftFilters((prev) => ({ ...prev, selectedDistricts: active ? prev.selectedDistricts.filter((d) => d !== district) : [...prev.selectedDistricts, district] }))}>{district}</button>;
            })}</div>
          </div>
          <button className="min-h-11 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={() => { applyFilters(); setMobileFiltersOpen(false); }} disabled={!hasPendingFilterChanges}>Filter anwenden</button>
        </div>
      </MobileFilterSheet>

      <ListingDrawer listing={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
