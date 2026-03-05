import { getListings } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export default async function DealsPage() {
  const listings = await getListings("min_score=85&sort=score&limit=120");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Deal Radar</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((l) => (
          <div key={`${l.source}-${l.source_listing_id}`} className="rounded-xl border p-4 text-sm">
            <p className="mb-1 text-lg font-semibold">Score {Math.round(l.deal_score || 0)}</p>
            <p className="font-medium">{l.title || "Ohne Titel"}</p>
            <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
            <p className="mt-2">{eur(l.price_eur)} · {eur(l.price_per_sqm)}/m²</p>
            <div className="mt-2 flex gap-2">
              <a href={l.url} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs">Open</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
