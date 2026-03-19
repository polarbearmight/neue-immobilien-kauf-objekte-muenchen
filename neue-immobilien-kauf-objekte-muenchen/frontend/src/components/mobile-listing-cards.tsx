"use client";

import { memo, useState } from "react";
import { ArrowUpRight, Heart, MapPin, Radar, Ruler, Star, Wallet } from "lucide-react";
import { API_URL, Listing } from "@/lib/api";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";
import { cn } from "@/lib/utils";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

function scoreTone(score?: number | null) {
  const v = score || 0;
  if (v >= 95) return "bg-amber-300 text-[#1a1408] shadow-[0_12px_30px_rgba(245,197,66,0.28)]";
  if (v >= 80) return "bg-emerald-500 text-white";
  if (v >= 60) return "bg-amber-400 text-[#17181c]";
  return "bg-rose-500 text-white";
}

function MobileListingCardsInner({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  if (!rows.length) return null;

  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => {
        const badges = listingHighlightBadges(row);
        const rowClass = listingHighlightRowClass(row);
        const isPremium = (row.deal_score || 0) >= 95;

        return (
          <div
            key={row.id}
            className={cn(
              "rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-200 active:scale-[0.99] dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(34,27,14,0.92),rgba(10,12,16,0.98))] dark:shadow-[0_18px_50px_rgba(0,0,0,0.28)]",
              rowClass,
              isPremium && "dark:shadow-[0_20px_70px_rgba(245,197,66,0.12)]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex min-h-6 flex-wrap items-center gap-1.5">
                  {badges.slice(0, 3).map((badge) => (
                    <span key={badge.key} className={cn("rounded-full border px-2 py-0.5 text-[10px]", badgeToneClass(badge.tone))}>
                      {badge.label}
                    </span>
                  ))}
                  {badges.length > 3 ? <span className="text-[10px] text-muted-foreground dark:text-amber-100/56">+{badges.length - 3}</span> : null}
                </div>
                <p className="line-clamp-2 text-base font-semibold leading-snug text-balance dark:text-amber-50">{row.title || "Ohne Titel"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground dark:text-amber-100/72">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{row.district || "München"}</span>
                  <span>·</span>
                  <span>{row.rooms ?? "-"} Zi.</span>
                  <span>·</span>
                  <span>{row.area_sqm ?? "-"} m²</span>
                </div>
              </div>
              <div className={cn("rounded-2xl px-3 py-2 text-sm font-semibold", scoreTone(row.deal_score))}>{Math.round(row.deal_score || 0)}</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.04]">
                <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60"><Wallet className="h-3.5 w-3.5" />Preis</div>
                <div className="mt-2 text-sm font-semibold dark:text-amber-50">{eur(row.price_eur)}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.04]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60">€/m²</div>
                <div className="mt-2 text-sm font-semibold dark:text-amber-50">{row.price_per_sqm ? `${Math.round(row.price_per_sqm)} €` : "-"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.04]">
                <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60"><Radar className="h-3.5 w-3.5" />Quelle</div>
                <div className="mt-2 truncate text-sm font-semibold dark:text-amber-50">{row.source}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-[1.1rem] border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground dark:border-amber-400/14 dark:bg-white/[0.03] dark:text-amber-100/70">
              <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />Investment</span>
              <span className="font-semibold dark:text-amber-50">{row.investment_score != null ? Math.round(row.investment_score) : "-"}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground dark:border dark:border-amber-300/35 dark:bg-amber-300 dark:text-[#1a1408]" onClick={() => onDetails(row)}>Details</button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium dark:border-amber-400/16 dark:bg-white/[0.03] dark:text-amber-50"
                onClick={async () => {
                  if (!row.id) return;
                  setSavedIds((prev) => ({ ...prev, [row.id as number]: true }));
                  try {
                    await fetch(`${API_URL}/api/watchlist/${row.id}`, { method: "POST" });
                  } catch {
                    setSavedIds((prev) => ({ ...prev, [row.id as number]: false }));
                  }
                }}
              >
                {savedIds[row.id || -1] ? <Star className="h-4 w-4 fill-current" /> : <Heart className="h-4 w-4" />}
                {savedIds[row.id || -1] ? "Gespeichert" : "Merken"}
              </button>
            </div>

            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground dark:border-amber-400/14 dark:bg-white/[0.03] dark:text-amber-100/78"
              >
                Exposé öffnen
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const MobileListingCards = memo(MobileListingCardsInner);
