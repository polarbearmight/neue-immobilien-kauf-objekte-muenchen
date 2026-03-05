import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getListings, getStats } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

export default async function Page() {
  const [stats, listings] = await Promise.all([getStats(7), getListings("sort=newest&limit=20")]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Neue Kaufwohnungen München – neueste zuerst.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">New last 7d</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.new_listings}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Median/avg €/m²</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(stats.avg_price_per_sqm)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Top deals</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.top_deals ?? 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Listings loaded</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{listings.length}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Latest Listings</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {listings.map((l) => (
              <a key={`${l.source}-${l.source_listing_id}`} href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                <div>
                  <p className="font-medium">{l.title || "Ohne Titel"}</p>
                  <p className="text-muted-foreground">{l.district || "-"} · {l.area_sqm || "-"} m² · {l.rooms || "-"} Zi.</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{eur(l.price_eur)}</p>
                  <p className="text-muted-foreground">{eur(l.price_per_sqm)}/m²</p>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
