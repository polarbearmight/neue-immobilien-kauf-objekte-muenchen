import { getListings } from "@/lib/api";

export default async function BrandNewPage() {
  const listings = await getListings("brand_new=true&sort=newest&limit=100");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Brand New</h1>
      <ul className="space-y-2">
        {listings.map((l) => (
          <li key={`${l.source}-${l.source_listing_id}`} className="rounded-lg border p-3 text-sm">
            {l.title || "Ohne Titel"} <span className="text-muted-foreground">({l.source})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
