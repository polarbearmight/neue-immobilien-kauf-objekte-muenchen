"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Sparkles } from "lucide-react";
import { API_URL, Listing } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";
import { StateCard } from "@/components/state-card";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

function DealRadarSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ min_score: String(debouncedMinScore), sort: sortBy, limit: "160" });
        if (debouncedPriceMin !== "") params.set("price_min", String(debouncedPriceMin));
        if (debouncedPriceMax !== "") params.set("price_max", String(debouncedPriceMax));
        const res = await fetch(`${API_URL}/api/listings?${params.toString()}`, { cache: "no-store" });
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

  const sortedListings = useMemo(
    () => listings.filter((listing) => !listing.id || !optimisticHiddenIds.includes(listing.id)),
    [listings, optimisticHiddenIds]
  );

  useEffect(() => {
    setActiveIndex(0);
    setOptimisticHiddenIds([]);
  }, [debouncedMinScore, debouncedPriceMin, debouncedPriceMax, sortBy]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(sortedListings.length - 1, 0)));
  }, [sortedListings.length]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const saveToWatchlist = async (listingId?: number) => {
    if (!listingId) return false;
    setSavingIds((prev) => ({ ...prev, [listingId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${listingId}`, { method: "POST" });
      if (!res.ok) throw new Error("watchlist_save_failed");
      setSavedIds((prev) => ({ ...prev, [listingId]: true }));
      return true;
    } catch {
      return false;
    } finally {
      setSavingIds((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const cycleIndex = (direction: 1 | -1) => {
    if (!sortedListings.length) return;
    setActiveIndex((prev) => (prev + direction + sortedListings.length) % sortedListings.length);
  };

  const rateActiveDeal = async (direction: "save" | "skip") => {
    const listing = sortedListings[activeIndex];
    if (!listing) return;

    if (direction === "save") {
      const ok = await saveToWatchlist(listing.id);
      setFeedback(ok ? "Zur Watchlist gespeichert" : "Speichern fehlgeschlagen");
      if (!ok) return;
    } else {
      setFeedback("Deal übersprungen");
    }

    if (listing.id) {
      setOptimisticHiddenIds((prev) => [...prev, listing.id!]);
    } else {
      cycleIndex(1);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void rateActiveDeal("skip");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void rateActiveDeal("save");
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        cycleIndex(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        cycleIndex(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, sortedListings]);

  const activeListing = sortedListings[activeIndex] || null;
  const stackListings = sortedListings.slice(activeIndex, activeIndex + 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deal Radar</h1>
          <p className="text-sm text-muted-foreground">Swipe-Gefühl mit Tastatur: ← überspringen, → merken, ↑/↓ im Stack bewegen.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div className="w-72">
            <label className="mb-1 block text-muted-foreground">Mindest-Score: {minScore}</label>
            <input className="w-full" type="range" min={70} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Preis min</label>
            <input className="rounded border px-2 py-1" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Preis max</label>
            <input className="rounded border px-2 py-1" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground">Sortierung</label>
            <select className="rounded border px-2 py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "investment") }>
              <option value="score">Score</option>
              <option value="investment">Investment-Score</option>
            </select>
          </div>
        </div>
      </div>

      {feedback ? <div className="rounded-2xl border border-border bg-card px-4 py-2 text-sm">{feedback}</div> : null}

      {error ? <StateCard title="Deal Radar nicht verfügbar" body={error} tone="error" /> : loading ? <DealRadarSkeleton /> : sortedListings.length === 0 ? (
        <StateCard title="Keine Treffer" body="Für den aktuellen Score- und Sortierfilter wurden keine passenden Listings gefunden." tone="muted" />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"><Sparkles className="h-4 w-4" /> Radar Stack</span>
                <span>{activeIndex + 1} / {sortedListings.length}</span>
              </div>
              <div className="relative min-h-[390px]">
                {stackListings.map((l, idx) => {
                  const h = listingHighlightBadges(l);
                  const rowClass = listingHighlightRowClass(l);
                  const isActive = idx === 0;
                  return (
                    <div
                      key={`${l.source}-${l.source_listing_id}-${idx}`}
                      className={`absolute inset-0 rounded-[1.75rem] border p-5 text-sm transition duration-200 ${rowClass} ${isActive ? "shadow-xl" : "shadow-sm"}`}
                      style={{
                        transform: `translateY(${idx * 14}px) scale(${1 - idx * 0.04})`,
                        opacity: 1 - idx * 0.18,
                        zIndex: 20 - idx,
                        pointerEvents: isActive ? "auto" : "none",
                      }}
                    >
                      <div className="mb-2 flex min-h-6 items-center gap-1 overflow-hidden whitespace-nowrap">
                        {h.slice(0, 3).map((b) => <span key={b.key} className={`rounded border px-1.5 py-0.5 text-[10px] ${badgeToneClass(b.tone)}`}>{b.label}</span>)}
                        {h.length > 3 ? <span className="text-[10px] text-muted-foreground">+{h.length - 3}</span> : null}
                      </div>
                      <p className="mb-1 text-lg font-semibold">Score {Math.round(l.deal_score || 0)}{l.investment_score != null ? ` · Inv ${Math.round(l.investment_score)}` : ""}</p>
                      <p className="font-medium text-balance">{l.display_title || l.title || "Ohne Titel"}</p>
                      <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-muted/50 px-3 py-3"><div className="text-xs text-muted-foreground">Preis</div><div className="mt-1 font-semibold">{eur(l.price_eur)}</div></div>
                        <div className="rounded-2xl bg-muted/50 px-3 py-3"><div className="text-xs text-muted-foreground">€/m²</div><div className="mt-1 font-semibold">{eur(l.price_per_sqm)}</div></div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <a href={l.url} target="_blank" rel="noreferrer" className="rounded-2xl border px-3 py-2 text-xs">Öffnen</a>
                        <button className="rounded-2xl border px-3 py-2 text-xs" onClick={() => void rateActiveDeal("skip")}>Skip</button>
                        <button
                          className="rounded-2xl border px-3 py-2 text-xs"
                          onClick={() => void rateActiveDeal("save")}
                          disabled={!l.id || !!savingIds[l.id]}
                        >
                          {l.id && savingIds[l.id] ? "Speichert…" : l.id && savedIds[l.id] ? "Gespeichert" : "Zur Watchlist"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Deal Flow</h2>
                <div className="flex gap-2">
                  <button className="rounded-full border border-border p-2" onClick={() => cycleIndex(-1)} aria-label="Vorheriger Deal"><ArrowLeft className="h-4 w-4" /></button>
                  <button className="rounded-full border border-border p-2" onClick={() => cycleIndex(1)} aria-label="Nächster Deal"><ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quick keys</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background px-3 py-2">← Deal skippen</div>
                    <div className="rounded-xl border border-border bg-background px-3 py-2">→ Zur Watchlist</div>
                    <div className="rounded-xl border border-border bg-background px-3 py-2">↑ / ↓ Stack bewegen</div>
                    <div className="rounded-xl border border-border bg-background px-3 py-2">Optimistisch aus dem Radar entfernen</div>
                  </div>
                </div>
                {activeListing ? (
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Aktiver Deal</p>
                    <p className="mt-2 font-medium">{activeListing.display_title || activeListing.title || "Ohne Titel"}</p>
                    <p className="mt-1 text-muted-foreground">{activeListing.district || "München"} · Quelle {activeListing.source}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Heart className="h-4 w-4 text-rose-500" /> {Object.keys(savedIds).length} gemerkt · {optimisticHiddenIds.length} verarbeitet
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedListings.map((l, index) => {
              const h = listingHighlightBadges(l);
              const rowClass = listingHighlightRowClass(l);
              const isUltra = (l.deal_score || 0) >= 95;
              const isActive = index === activeIndex;
              return (
                <div key={`${l.source}-${l.source_listing_id}`} className={`rounded-xl border p-4 text-sm ${rowClass} ${isUltra ? "shadow-md" : ""} ${isActive ? "ring-2 ring-primary/40" : ""}`}>
                  <div className="mb-2 flex min-h-6 items-center gap-1 overflow-hidden whitespace-nowrap">
                    {h.slice(0, 3).map((b) => <span key={b.key} className={`rounded border px-1.5 py-0.5 text-[10px] ${badgeToneClass(b.tone)}`}>{b.label}</span>)}
                    {h.length > 3 ? <span className="text-[10px] text-muted-foreground">+{h.length - 3}</span> : null}
                  </div>
                  <p className="mb-1 text-lg font-semibold">Score {Math.round(l.deal_score || 0)}{l.investment_score != null ? ` · Inv ${Math.round(l.investment_score)}` : ""}</p>
                  <p className="font-medium">{l.display_title || l.title || "Ohne Titel"}</p>
                  <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
                  <p className="mt-2">{eur(l.price_eur)} · {eur(l.price_per_sqm)}/m²</p>
                  <div className="mt-2 flex gap-2">
                    <a href={l.url} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs">Öffnen</a>
                    <button className="rounded border px-2 py-1 text-xs" onClick={() => setActiveIndex(index)}>Fokus</button>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() => void saveToWatchlist(l.id)}
                      disabled={!l.id || !!savingIds[l.id]}
                    >
                      {l.id && savingIds[l.id] ? "Speichert…" : l.id && savedIds[l.id] ? "Gespeichert" : "Zur Watchlist"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
