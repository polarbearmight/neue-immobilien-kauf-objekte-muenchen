"use client";

import { useEffect, useMemo, useState } from "react";
import { Listing, API_URL, parseBadges } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MiniBarChart } from "@/components/mini-bar-chart";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

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
  const snapshots = useMemo(() => detail?.price_history?.snapshots ?? [], [detail?.price_history?.snapshots]);
  const miniSeries = useMemo(
    () => snapshots.slice(-10).map((s) => ({ label: s.captured_at.slice(0, 10), value: Number(s.price_eur || 0) })),
    [snapshots],
  );

  if (!l) return null;

  const badgeList = parseBadges(l.badges);

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="flex-1 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listing Details</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
        </div>

        <div className="space-y-4 text-sm">
          <p className="text-base font-semibold">{l.title || "Ohne Titel"}</p>
          <p className="text-muted-foreground">{l.district || "-"} · {l.source}</p>
          <a href={l.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-blue-600 underline underline-offset-2">{l.url}</a>
          <div className="flex flex-wrap gap-1">
            {badgeList.length ? badgeList.map((b) => <span key={b} className="rounded-full border px-2 py-0.5 text-xs">{b}</span>) : <span className="text-xs text-muted-foreground">No badges</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
            <div><p className="text-muted-foreground">Preis</p><p className="font-medium">{eur(l.price_eur)}</p></div>
            <div><p className="text-muted-foreground">€/m²</p><p className="font-medium">{eur(l.price_per_sqm)}</p></div>
            <div><p className="text-muted-foreground">Fläche</p><p className="font-medium">{l.area_sqm || "-"} m²</p></div>
            <div><p className="text-muted-foreground">Zimmer</p><p className="font-medium">{l.rooms || "-"}</p></div>
            <div><p className="text-muted-foreground">Adresse</p><p className="font-medium">{l.address || "-"}</p></div>
            <div><p className="text-muted-foreground">Score</p><p className="font-medium">{Math.round(l.deal_score || 0)}</p></div>
            <div><p className="text-muted-foreground">First Seen</p><p className="font-medium">{l.first_seen_at ? new Date(l.first_seen_at).toLocaleString("de-DE") : "-"}</p></div>
            <div><p className="text-muted-foreground">Posted At</p><p className="font-medium">{l.posted_at ? new Date(l.posted_at).toLocaleString("de-DE") : "-"}</p></div>
          </div>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">A) Score Explanation</summary>
            <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{l.score_explain || "-"}</p>
          </details>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">B) Source Information</summary>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Source: {detail?.source?.name || l.source}</p>
              <p>Reliability: {detail?.source?.reliability_score ?? "-"}</p>
              <p>Cluster members: {detail?.cluster?.members_count ?? 0}</p>
              <p>Seen on: {(detail?.cluster?.sources || []).join(", ") || "-"}</p>
            </div>
          </details>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">C) Price History</summary>
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <p>Old: {eur(detail?.price_history?.old_price)} · Current: {eur(detail?.price_history?.current_price)}</p>
              {detail?.price_history?.has_price_drop ? <p className="text-green-700">PRICE DROP</p> : null}
              {miniSeries.length ? <MiniBarChart data={miniSeries} /> : null}
              {snapshots.length ? snapshots.slice(-8).reverse().map((s) => (
                <p key={s.id}>{new Date(s.captured_at).toLocaleString("de-DE")} · {eur(s.price_eur)}</p>
              )) : <p>-</p>}
            </div>
          </details>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">D) Investment Section</summary>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Estimated rent €/m²: {eur(l.estimated_rent_per_sqm)}</p>
              <p>Estimated monthly rent: {eur(l.estimated_monthly_rent)}</p>
              <p>Gross yield: {l.gross_yield_percent != null ? `${l.gross_yield_percent.toFixed(2)}%` : "-"}</p>
              <p>Price-to-rent ratio: {l.price_to_rent_ratio != null ? l.price_to_rent_ratio.toFixed(2) : "-"}</p>
              <p>Investment score: {l.investment_score != null ? Math.round(l.investment_score) : "-"}</p>
              <p className="whitespace-pre-wrap">Explain: {l.investment_explain || "-"}</p>
            </div>
          </details>

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">E) Off-Market Section (placeholder)</summary>
            <p className="mt-2 text-muted-foreground">Off-market scoring follows in the next feature step.</p>
          </details>

          {(detail?.cluster?.members || []).length > 1 ? (
            <details className="rounded border p-2" open>
              <summary className="cursor-pointer font-medium">Seen on</summary>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {detail?.cluster?.members.map((m) => (
                  <p key={m.id}>{m.source} · {eur(m.price_eur)} · {m.title || "-"}{m.is_canonical ? " · canonical" : ""}</p>
                ))}
              </div>
            </details>
          ) : null}

          <details className="rounded border p-2" open>
            <summary className="cursor-pointer font-medium">AI Flags</summary>
            <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{l.ai_flags || "-"}</p>
          </details>

          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background pt-3">
            <a href={l.url} target="_blank" rel="noreferrer" className="inline-block rounded bg-black px-3 py-2 text-sm text-white hover:opacity-90">Open listing ↗</a>
            <button className="inline-block rounded border px-3 py-2 text-sm hover:bg-muted" onClick={async () => {
              try { await navigator.clipboard.writeText(l.url); } catch {}
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
