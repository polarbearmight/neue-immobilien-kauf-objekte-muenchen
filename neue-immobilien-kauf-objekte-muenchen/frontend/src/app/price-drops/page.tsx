import { getPriceDrops } from "@/lib/api";

export default async function PriceDropsPage() {
  const items = await getPriceDrops();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Price Drops</h1>
      <ul className="space-y-2">
        {items.map((l) => (
          <li key={`${l.source}-${l.source_listing_id}`} className="rounded-lg border p-3 text-sm">
            {l.title || "Ohne Titel"} · {l.district || "-"}
          </li>
        ))}
      </ul>
    </div>
  );
}
