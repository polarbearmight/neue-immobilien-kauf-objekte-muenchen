"use client";

import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type DistrictRow = {
  district: string;
  listing_count: number;
  median_or_avg_ppsqm: number | null;
  top_deals: number;
  avg_score: number | null;
};

const eur = (v?: number | null) => (v == null ? "-" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €/m²`);

export default function DistrictsPage() {
  const [rows, setRows] = useState<DistrictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/districts`, { cache: "no-store", headers: authHeaders() });
        if (!res.ok) throw new Error(`districts_${res.status}`);
        setRows(await res.json());
      } catch {
        setRows([]);
        setError("Stadtteil-Statistiken konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <StateCard title="Stadtteile werden geladen" body="Die District-Statistiken werden vorbereitet." tone="muted" />;
  if (error) return <StateCard title="Districts nicht verfügbar" body={error} tone="error" />;

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
