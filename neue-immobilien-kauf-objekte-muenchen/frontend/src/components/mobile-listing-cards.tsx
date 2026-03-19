"use client";

import { memo, useState } from "react";
import { Heart, MapPin, Ruler, Star, Wallet } from "lucide-react";
import { API_URL, Listing } from "@/lib/api";
import { cn } from "@/lib/utils";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

function scoreTone(score?: number | null) {
  const v = score || 0;
  if (v >= 80) return "bg-emerald-500 text-white";
  if (v >= 60) return "bg-amber-400 text-[#17181c]";
  return "bg-rose-500 text-white";
}

function MobileListingCardsInner({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  if (!rows.length) return null;

  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <div key={row.id} className="rounded-[1.75rem] border border-border/80 bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-200 active:scale-[0.99] dark:border-white/12 dark:bg-[rgba(10,12,16,0.96)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-base font-semibold leading-snug">{row.title || "Ohne Titel"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-white/8 dark:bg-white/[0.04]">
              <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Preis</div>
              <div className="mt-2 text-sm font-semibold">{eur(row.price_eur)}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-white/8 dark:bg-white/[0.04]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">€/m²</div>
              <div className="mt-2 text-sm font-semibold">{row.price_per_sqm ? `${Math.round(row.price_per_sqm)} €` : "-"}</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-3 dark:border-white/8 dark:bg-white/[0.04]">
              <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"><Ruler className="h-3.5 w-3.5" />Quelle</div>
              <div className="mt-2 truncate text-sm font-semibold">{row.source}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="min-h-11 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => onDetails(row)}>Details</button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium dark:border-white/12"
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
        </div>
      ))}
    </div>
  );
}

export const MobileListingCards = memo(MobileListingCardsInner);
