"use client";

import { API_URL, Listing, authHeaders } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export function MobileListingCards({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  if (!rows.length) return null;

  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <div key={row.id} className="rounded-[1.6rem] border border-white/70 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-950">{row.title || "Ohne Titel"}</p>
              <p className="mt-1 text-sm text-slate-500">{row.district || "München"} · {row.rooms ?? "-"} Zi. · {row.area_sqm ?? "-"} m²</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">{Math.round(row.deal_score || 0)}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="text-slate-500">Preis</div><div className="mt-1 font-semibold">{eur(row.price_eur)}</div></div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3"><div className="text-slate-500">€/m²</div><div className="mt-1 font-semibold">{row.price_per_sqm ? `${Math.round(row.price_per_sqm)} €/m²` : "-"}</div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium" href={row.url} target="_blank" rel="noreferrer">Öffnen</a>
            <button className="min-h-11 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={() => onDetails(row)}>Details</button>
            <button className="col-span-2 min-h-11 rounded-2xl border px-4 py-2 text-sm font-medium" onClick={async () => { if (!row.id) return; await fetch(`${API_URL}/api/watchlist/${row.id}`, { method: "POST", headers: authHeaders() }); }}>Merken</button>
          </div>
        </div>
      ))}
    </div>
  );
}
