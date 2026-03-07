"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type DistrictDebugRow = {
  id: number;
  source: string;
  title?: string;
  raw_address?: string;
  postal_code?: string;
  raw_district_text?: string;
  district?: string;
  district_source?: string;
  location_confidence?: number;
};

type DistrictQuality = {
  total: number;
  assigned_pct: number;
  coordinates_pct: number;
  postal_code_pct: number;
  title_only_pct: number;
  unknown_pct: number;
};

export default function DistrictDebugPage() {
  const [rows, setRows] = useState<DistrictDebugRow[]>([]);
  const [quality, setQuality] = useState<DistrictQuality | null>(null);
  const [source, setSource] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState<number>(0);

  const load = async () => {
    const q = new URLSearchParams({ limit: "500" });
    if (source !== "all") q.set("source", source);

    const [dr, qr] = await Promise.all([
      fetch(`${API_URL}/api/district-debug?${q.toString()}`, { cache: "no-store" }),
      fetch(`${API_URL}/api/district-quality`, { cache: "no-store" }),
    ]);

    setRows((await dr.json()) || []);
    setQuality((await qr.json()) || null);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    load();
  }, [source]);

  const sources = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.source))).sort((a, b) => a.localeCompare(b))],
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => (r.location_confidence || 0) >= minConfidence);
  }, [rows, minConfidence]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">District Debug</h1>

      {quality ? (
        <div className="grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          <p>Total: <strong>{quality.total}</strong></p>
          <p>Assigned: <strong>{quality.assigned_pct}%</strong></p>
          <p>Coordinates: <strong>{quality.coordinates_pct}%</strong></p>
          <p>Postal code: <strong>{quality.postal_code_pct}%</strong></p>
          <p>Title only: <strong>{quality.title_only_pct}%</strong></p>
          <p>Unknown: <strong>{quality.unknown_pct}%</strong></p>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl border p-3 text-sm md:grid-cols-3">
        <label>
          <span className="mb-1 block text-muted-foreground">Source</span>
          <select className="w-full rounded border px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-muted-foreground">Min confidence</span>
          <input className="w-full" type="range" min={0} max={100} value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value || 0))} />
          <span className="text-xs text-muted-foreground">{minConfidence}</span>
        </label>

        <div className="flex items-end">
          <button className="rounded border px-3 py-1" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-2 py-1">source</th>
              <th className="px-2 py-1">title</th>
              <th className="px-2 py-1">raw address</th>
              <th className="px-2 py-1">postal</th>
              <th className="px-2 py-1">raw district</th>
              <th className="px-2 py-1">district</th>
              <th className="px-2 py-1">district_source</th>
              <th className="px-2 py-1">confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-b ${(r.district_source === "unknown" || (r.location_confidence || 0) < 40) ? "bg-amber-50" : ""}`}>
                <td className="px-2 py-1">{r.source}</td>
                <td className="max-w-[280px] truncate px-2 py-1">{r.title || "-"}</td>
                <td className="max-w-[280px] truncate px-2 py-1">{r.raw_address || "-"}</td>
                <td className="px-2 py-1">{r.postal_code || "-"}</td>
                <td className="px-2 py-1">{r.raw_district_text || "-"}</td>
                <td className="px-2 py-1">{r.district || "-"}</td>
                <td className="px-2 py-1">{r.district_source || "-"}</td>
                <td className="px-2 py-1">{Math.round(r.location_confidence || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
