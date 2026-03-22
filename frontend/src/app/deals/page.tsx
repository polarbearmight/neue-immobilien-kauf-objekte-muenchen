"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, SlidersHorizontal, Sparkles, TrendingUp } from "lucide-react";
import { API_URL, Listing, authHeaders } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";
import { StateCard } from "@/components/state-card";

const eur = (v?: number | null) =>
  v == null
    ? "-"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);

function DealRadarSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm dark:border-amber-400/15 dark:bg-[rgba(10,12,16,0.94)]">
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted/60" />
          <div className="mt-4 h-8 w-32 animate-pulse rounded-xl bg-muted/60" />
          <div className="mt-3 h-5 w-3/4 animate-pulse rounded-lg bg-muted/60" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded-lg bg-muted/50" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
          </div>
          <div className="mt-5 flex gap-2">
            <div className="h-10 flex-1 animate-pulse rounded-2xl bg-muted/60" />
            <div className="h-10 flex-1 animate-pulse rounded-2xl bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const [minScore, setMinScore] = useState(85);
  const [sortBy, setSortBy] = useState<"score" | "investment">("score");
  const [priceMin, setPriceMin] = useState<number | "">("");
  const [priceMax, setPriceMax] = useState<number | "">("");
  const debouncedMinScore = useDebouncedValue(minScore, 250);
  const debouncedPriceMin = useDebouncedValue(priceMin, 400);
  const debouncedPriceMax = useDebouncedValue(priceMax, 400);
  const [listings, setListings] = useState<Listing[]>([]);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ min_score: String(debouncedMinScore), sort: sortBy, limit: "5000" });
        if (debouncedPriceMin !== "") params.set("price_min", String(debouncedPriceMin));
        if (debouncedPriceMax !== "") params.set("price_max", String(debouncedPriceMax));
        const res = await fetch(`${API_URL}/api/listings?${params.toString()}`, { cache: "no-store", headers: authHeaders() });
        if (!res.ok) throw new Error(`deals_${res.status}`);
        setListings(await res.json());
      } catch {
        setListings([]);
        setError("Deals konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [debouncedMinScore, debouncedPriceMin, debouncedPriceMax, sortBy]);

  useEffect(() => {
    setHiddenIds([]);
  }, [debouncedMinScore, debouncedPriceMin, debouncedPriceMax, sortBy]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const visibleListings = useMemo(
    () => listings.filter((listing) => !listing.id || !hiddenIds.includes(listing.id)),
    [hiddenIds, listings]
  );

  const topCount = useMemo(() => visibleListings.filter((listing) => (listing.deal_score || 0) >= 90).length, [visibleListings]);
  const avgScore = useMemo(() => {
    if (!visibleListings.length) return 0;
    return Math.round(visibleListings.reduce((sum, listing) => sum + (listing.deal_score || 0), 0) / visibleListings.length);
  }, [visibleListings]);

  const saveToWatchlist = useCallback(async (listingId?: number) => {
    if (!listingId) return false;
    setSavingIds((prev) => ({ ...prev, [listingId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${listingId}`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error("watchlist_save_failed");
      setSavedIds((prev) => ({ ...prev, [listingId]: true }));
      return true;
    } catch {
      return false;
    } finally {
      setSavingIds((prev) => ({ ...prev, [listingId]: false }));
    }
  }, []);

  const hideListing = useCallback((listingId?: number) => {
    if (!listingId) return;
    setHiddenIds((prev) => [...prev, listingId]);
    setFeedback("Deal ausgeblendet");
  }, []);

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-amber-400/20 dark:bg-[radial-gradient(circle_at_top,rgba(245,197,66,0.14),rgba(10,12,16,0.96)_36%,rgba(10,12,16,0.98)_100%)] dark:shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Deal Radar
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Deals in einer klaren, mobilen Übersicht</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-[15px]">
              Kein Karten-Stack mehr: die besten Treffer stehen direkt als saubere Deal-Liste mit Score, Investment-Wert und schnellen Watchlist-Aktionen bereit.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Treffer</div>
              <div className="mt-2 text-xl font-semibold">{visibleListings.length}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Top Deals</div>
              <div className="mt-2 text-xl font-semibold">{topCount}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ø Score</div>
              <div className="mt-2 text-xl font-semibold">{avgScore || "-"}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gemerkt</div>
              <div className="mt-2 text-xl font-semibold">{Object.keys(savedIds).length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border/80 bg-card/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)] dark:border-amber-400/15 dark:bg-[rgba(10,12,16,0.94)] md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Deal-Filter
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
            <div className="xl:w-72">
              <label className="mb-1 block text-sm text-muted-foreground">Mindest-Score: {minScore}</label>
              <input className="w-full" type="range" min={70} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Preis min</label>
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 dark:border-amber-400/15 dark:bg-white/[0.03] dark:text-amber-50" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Preis max</label>
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 dark:border-amber-400/15 dark:bg-white/[0.03] dark:text-amber-50" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Sortierung</label>
              <select className="w-full rounded-xl border border-border bg-background px-3 py-2 dark:border-amber-400/15 dark:bg-white/[0.03] dark:text-amber-50" value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "investment") }>
                <option value="score">Score</option>
                <option value="investment">Investment-Score</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {feedback ? <div className="rounded-2xl border border-border bg-card px-4 py-2 text-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">{feedback}</div> : null}

      {error ? (
        <StateCard title="Deal Radar nicht verfügbar" body={error} tone="error" />
      ) : loading ? (
        <DealRadarSkeleton />
      ) : visibleListings.length === 0 ? (
        <StateCard title="Keine Treffer" body="Für den aktuellen Score- und Sortierfilter wurden keine passenden Listings gefunden." tone="muted" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleListings.map((listing) => {
            const badges = listingHighlightBadges(listing);
            const rowClass = listingHighlightRowClass(listing);
            const isUltra = (listing.deal_score || 0) >= 95;
            return (
              <article
                key={`${listing.source}-${listing.source_listing_id}`}
                className={`rounded-[1.75rem] border p-4 text-sm shadow-sm transition duration-200 md:p-5 ${rowClass} ${isUltra ? "shadow-[0_20px_60px_rgba(245,197,66,0.16)] dark:shadow-[0_20px_70px_rgba(245,197,66,0.10)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex min-h-6 flex-wrap items-center gap-1.5">
                      {badges.slice(0, 4).map((badge) => (
                        <span key={badge.key} className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeToneClass(badge.tone)}`}>
                          {badge.label}
                        </span>
                      ))}
                      {badges.length > 4 ? <span className="text-[10px] text-muted-foreground">+{badges.length - 4}</span> : null}
                    </div>
                    <h2 className="text-lg font-semibold text-balance">{listing.display_title || listing.title || "Ohne Titel"}</h2>
                    <p className="mt-1 text-muted-foreground">{listing.district || "-"} · {listing.area_sqm || "-"} m² · {listing.rooms || "-"} Zi. · Quelle {listing.source}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/80 px-3 py-2 text-right dark:border-amber-400/20 dark:bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                    <div className="text-lg font-semibold">{Math.round(listing.deal_score || 0)}</div>
                    {listing.investment_score != null ? <div className="text-xs text-muted-foreground">Inv {Math.round(listing.investment_score)}</div> : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-3 py-3 dark:border-amber-400/12 dark:bg-white/[0.03]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Preis</div>
                    <div className="mt-1 font-semibold">{eur(listing.price_eur)}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-3 py-3 dark:border-amber-400/12 dark:bg-white/[0.03]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">€/m²</div>
                    <div className="mt-1 font-semibold">{eur(listing.price_per_sqm)}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-3 py-3 dark:border-amber-400/12 dark:bg-white/[0.03]">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Investment</div>
                    <div className="mt-1 font-semibold">{listing.investment_score != null ? Math.round(listing.investment_score) : "-"}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-3 py-3 dark:border-amber-400/12 dark:bg-white/[0.03]">
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Signal
                    </div>
                    <div className="mt-1 font-semibold">{(listing.deal_score || 0) >= 95 ? "Elite" : (listing.deal_score || 0) >= 90 ? "Sehr stark" : "Beobachten"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-medium dark:border-amber-400/20 dark:bg-white/[0.03] dark:text-amber-50">
                    Öffnen
                  </a>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-medium dark:border-amber-400/20 dark:bg-white/[0.03] dark:text-amber-50" onClick={() => hideListing(listing.id)}>
                    Ausblenden
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:border dark:border-amber-300/30 dark:bg-amber-300 dark:text-[#1a1408]"
                    onClick={async () => {
                      const ok = await saveToWatchlist(listing.id);
                      setFeedback(ok ? "Zur Watchlist gespeichert" : "Speichern fehlgeschlagen");
                    }}
                    disabled={!listing.id || !!savingIds[listing.id]}
                  >
                    <Heart className="h-4 w-4" />
                    {listing.id && savingIds[listing.id] ? "Speichert…" : listing.id && savedIds[listing.id] ? "Gespeichert" : "Zur Watchlist"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
