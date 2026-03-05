import { getPriceDrops } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export default async function PriceDropsPage() {
  const items = await getPriceDrops();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Price Drops</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((l) => (
          <div key={`${l.source}-${l.source_listing_id}`} className="rounded-xl border p-4 text-sm">
            <p className="font-medium">{l.title || "Ohne Titel"}</p>
            <p className="text-muted-foreground">{l.district || "-"} · {l.source}</p>
            <p className="mt-2">Preis: <span className="font-semibold">{eur(l.price_eur)}</span> · {eur(l.price_per_sqm)}/m²</p>
            <a className="mt-2 inline-block text-xs underline" href={l.url} target="_blank" rel="noreferrer">Open</a>
          </div>
        ))}
      </div>
    </div>
  );
}
