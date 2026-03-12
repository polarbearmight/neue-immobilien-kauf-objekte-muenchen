import { getDistricts } from "@/lib/api";

type DistrictRow = {
  district: string;
  listing_count: number;
  median_or_avg_ppsqm: number | null;
  top_deals: number;
  avg_score: number | null;
};

const eur = (v?: number | null) => (v == null ? "-" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €/m²`);

export default async function DistrictsPage() {
  const rows: DistrictRow[] = await getDistricts();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Stadtteil-Statistiken</h1>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2">Stadtteil</th>
              <th className="px-3 py-2">Listings</th>
              <th className="px-3 py-2">Median/Ø €/m²</th>
              <th className="px-3 py-2">Top-Deals</th>
              <th className="px-3 py-2">Ø Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.district} className="border-b">
                <td className="px-3 py-2">{r.district}</td>
                <td className="px-3 py-2">{r.listing_count}</td>
                <td className="px-3 py-2">{eur(r.median_or_avg_ppsqm)}</td>
                <td className="px-3 py-2">{r.top_deals}</td>
                <td className="px-3 py-2">{r.avg_score == null ? "-" : Math.round(r.avg_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
