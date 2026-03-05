import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getListings } from "@/lib/api";

export default async function DealsPage() {
  const listings = await getListings("min_score=85&sort=score&limit=60");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Deal Radar</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((l) => (
          <Card key={`${l.source}-${l.source_listing_id}`}>
            <CardHeader><CardTitle className="text-base">{l.title || "Ohne Titel"}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{l.district || "-"} · Score {Math.round(l.deal_score || 0)}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
