"use client";

import { useEffect, useMemo, useState } from "react";
import { Listing, API_URL, parseBadges } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MiniBarChart } from "@/components/mini-bar-chart";
import { MetricTile, prettyJson, SectionCard } from "@/components/listing-detail-sections";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));
const normalizeExternalUrl = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw}`;
};

type DetailedListing = Listing & { address?: string | null; posted_at?: string | null; score_explain?: string | null; ai_flags?: string | null };

type ListingDetailPayload = {
  ok: boolean;
  listing: DetailedListing;
  source?: { name: string; reliability_score?: number | null } | null;
  cluster?: {
    cluster_id?: string | null;
    members_count: number;
    canonical_listing_id?: number | null;
    sources?: string[];
    members: Array<{ id: number; source: string; title?: string | null; url: string; price_eur?: number | null; is_canonical?: boolean }>;
  };
  price_history?: {
    old_price?: number | null;
    current_price?: number | null;
    has_price_drop?: boolean;
    snapshots: Array<{ id: number; captured_at: string; price_eur?: number | null }>;
  };
};

export function ListingDrawer({ listing, onClose }: { listing: Listing | null; onClose: () => void }) {
  const [detail, setDetail] = useState<ListingDetailPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!listing?.id) {
        setDetail(null);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/listings/${listing.id}/detail`, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`detail_${res.status}`);
        const data = await res.json();
        setDetail(data || null);
      } catch {
        if (!controller.signal.aborted) setDetail(null);
      }
    };
    load();
    return () => controller.abort();
  }, [listing?.id]);

  const l = detail?.listing || listing;
  const listingUrl = normalizeExternalUrl(l?.url);
  const snapshots = useMemo(() => detail?.price_history?.snapshots ?? [], [detail?.price_history?.snapshots]);
  const miniSeries = useMemo(
    () => snapshots.slice(-10).map((s) => ({ label: s.captured_at.slice(0, 10), value: Number(s.price_eur || 0) })),
    [snapshots],
  );

  if (!l) return null;

  const badgeList = parseBadges(l.badges);

  const scoreExplainPretty = prettyJson(l.score_explain);
  const investmentExplainPretty = prettyJson(l.investment_explain);
  const offMarketExplainPretty = prettyJson(l.off_market_explain);
  const aiFlagsPretty = prettyJson(l.ai_flags);
  const isSeed = l.source === "seed" || (l.title || "").toLowerCase().includes("seed-datensatz");

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/60 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between rounded-[1.6rem] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Listing Details</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{l.display_title || l.title || "Ohne Titel"}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            {isSeed ? <div className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Seed-/Fallback-Datensatz</div> : null}
            <p className="text-sm text-slate-500">{l.district || "-"} · {l.source}</p>
          {listingUrl ? (
            <a href={listingUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-600 underline underline-offset-2">{listingUrl}</a>
          ) : (
            <p className="text-xs text-muted-foreground">Kein Link verfügbar</p>
          )}
          <div className="flex flex-wrap gap-1">
            {badgeList.length ? badgeList.map((b) => <span key={b} className="rounded-full border px-2 py-0.5 text-xs">{b}</span>) : <span className="text-xs text-muted-foreground">No badges</span>}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Preis" value={eur(l.price_eur)} emphasize />
            <MetricTile label="€/m²" value={eur(l.price_per_sqm)} />
            <MetricTile label="Fläche" value={`${l.area_sqm || "-"} m²`} />
            <MetricTile label="Zimmer" value={l.rooms || "-"} />
            <MetricTile label="Adresse" value={l.address || "-"} />
            <MetricTile label="Score" value={Math.round(l.deal_score || 0)} emphasize />
            <MetricTile label="First Seen" value={l.first_seen_at ? new Date(l.first_seen_at).toLocaleString("de-DE") : "-"} />
            <MetricTile label="Posted At" value={l.posted_at ? new Date(l.posted_at).toLocaleString("de-DE") : "-"} />
          </div>
          </div>

          <SectionCard title="Score" subtitle="Warum der Deal so bewertet wurde">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{scoreExplainPretty || "Keine Detail-Erklärung verfügbar."}</pre>
          </SectionCard>

          <SectionCard title="Quelle" subtitle="Herkunft und Sichtbarkeit des Angebots">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Source" value={detail?.source?.name || l.source} />
              <MetricTile label="Reliability" value={detail?.source?.reliability_score ?? "-"} />
              <MetricTile label="Cluster Members" value={detail?.cluster?.members_count ?? 0} />
              <MetricTile label="Seen on" value={(detail?.cluster?.sources || []).join(", ") || "-"} />
            </div>
          </SectionCard>

          <SectionCard title="Preisverlauf" subtitle="Historie und mögliche Preisänderungen">
            <div className="space-y-3 text-xs text-slate-600">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile label="Alt" value={eur(detail?.price_history?.old_price)} />
                <MetricTile label="Aktuell" value={eur(detail?.price_history?.current_price)} emphasize />
              </div>
              {detail?.price_history?.has_price_drop ? <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Price Drop erkannt</div> : null}
              {miniSeries.length ? <MiniBarChart data={miniSeries} /> : null}
              <div className="space-y-2">
                {snapshots.length ? snapshots.slice(-8).reverse().map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3"><span>{new Date(s.captured_at).toLocaleString("de-DE")}</span><span className="font-medium text-slate-900">{eur(s.price_eur)}</span></div>
                )) : <p>-</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Investment" subtitle="Mietpotenzial und Rendite-Einschätzung">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricTile label="Rent €/m²" value={eur(l.estimated_rent_per_sqm)} />
              <MetricTile label="Monthly Rent" value={eur(l.estimated_monthly_rent)} />
              <MetricTile label="Gross Yield" value={l.gross_yield_percent != null ? `${l.gross_yield_percent.toFixed(2)}%` : "-"} emphasize />
              <MetricTile label="Price-to-Rent" value={l.price_to_rent_ratio != null ? l.price_to_rent_ratio.toFixed(2) : "-"} />
              <MetricTile label="Investment Score" value={l.investment_score != null ? Math.round(l.investment_score) : "-"} />
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{investmentExplainPretty || "Keine zusätzliche Investment-Erklärung verfügbar."}</pre>
          </SectionCard>

          <SectionCard title="Off-Market" subtitle="Exklusivität und Sichtbarkeits-Signale">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Off-market Score" value={l.off_market_score != null ? Math.round(l.off_market_score) : "-"} emphasize />
              <MetricTile label="Exclusivity" value={l.exclusivity_score != null ? Math.round(l.exclusivity_score) : "-"} />
              <MetricTile label="Source Popularity" value={l.source_popularity_score != null ? Math.round(l.source_popularity_score) : "-"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{parseBadges(l.off_market_flags).length ? parseBadges(l.off_market_flags).map((flag) => <span key={flag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">{flag}</span>) : <span className="text-xs text-slate-500">Keine Off-Market-Flags</span>}</div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{offMarketExplainPretty || "Keine zusätzliche Off-Market-Erklärung verfügbar."}</pre>
          </SectionCard>

          {(detail?.cluster?.members || []).length > 1 ? (
            <details className="rounded border p-2" open>
              <summary className="cursor-pointer font-medium">Seen on</summary>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {detail?.cluster?.members.map((m) => {
                  const memberUrl = normalizeExternalUrl(m.url);
                  return (
                    <p key={m.id}>
                      {m.source} · {eur(m.price_eur)} · {m.title || "-"}{m.is_canonical ? " · canonical" : ""}
                      {memberUrl ? (
                        <>
                          {" "}· <a href={memberUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline underline-offset-2">open</a>
                        </>
                      ) : null}
                    </p>
                  );
                })}
              </div>
            </details>
          ) : null}

          <SectionCard title="AI Flags" subtitle="Automatische Hinweise aus dem Analyse-Flow">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{aiFlagsPretty || "Keine AI Flags vorhanden."}</pre>
          </SectionCard>

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.96)_24%)] pt-4 pb-1">
            {listingUrl ? <a href={listingUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-black px-3 py-2 text-sm text-white hover:opacity-90">Open listing ↗</a> : null}
            <button className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted" onClick={async () => {
              try { await navigator.clipboard.writeText(listingUrl || l.url || ""); } catch {}
            }}>Copy link</button>
            <button className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted" onClick={async () => {
              if (!l.id) return;
              await fetch(`${API_URL}/api/watchlist/${l.id}`, { method: "POST" });
            }}>Save to Watchlist</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
