"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Row = {
  id: number;
  source: string;
  raw_title?: string;
  display_title?: string;
  raw_address?: string;
  raw_district_text?: string;
  postal_code?: string;
  district?: string;
  district_source?: string;
  location_confidence?: number;
  price_eur?: number;
  area_sqm?: number;
  rooms?: number;
  price_per_sqm?: number;
  cluster_id?: string;
  geo_status?: string;
  quality_flags?: string;
  url?: string;
};

export default function SourceDebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState("all");

  const load = async () => {
    const q = new URLSearchParams({ limit: "500" });
    if (source !== "all") q.set("source", source);
    const r = await fetch(`${API_URL}/api/source-debug?${q.toString()}`, { cache: "no-store" });
    setRows((await r.json()) || []);
  };

  useEffect(() => {
    load();
  }, [source]);

  const sources = useMemo(() => ["all", ...Array.from(new Set(rows.map((x) => x.source))).sort()], [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Source Debug</h1>
      <div className="rounded border p-3 text-sm">
        <label>
          Source
          <select className="ml-2 rounded border px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="ml-3 rounded border px-2 py-1" onClick={load}>Refresh</button>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-left">
              <th className="px-2 py-1">source</th><th className="px-2 py-1">raw title</th><th className="px-2 py-1">display title</th>
              <th className="px-2 py-1">raw address</th><th className="px-2 py-1">raw district</th><th className="px-2 py-1">postal</th>
              <th className="px-2 py-1">district</th><th className="px-2 py-1">district src</th><th className="px-2 py-1">loc conf</th>
              <th className="px-2 py-1">price</th><th className="px-2 py-1">sqm</th><th className="px-2 py-1">rooms</th><th className="px-2 py-1">ppsqm</th>
              <th className="px-2 py-1">cluster</th><th className="px-2 py-1">geo</th><th className="px-2 py-1">flags</th><th className="px-2 py-1">url</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-2 py-1">{r.source}</td>
                <td className="px-2 py-1 max-w-[180px] truncate">{r.raw_title || "-"}</td>
                <td className="px-2 py-1 max-w-[180px] truncate">{r.display_title || "-"}</td>
                <td className="px-2 py-1 max-w-[180px] truncate">{r.raw_address || "-"}</td>
                <td className="px-2 py-1">{r.raw_district_text || "-"}</td>
                <td className="px-2 py-1">{r.postal_code || "-"}</td>
                <td className="px-2 py-1">{r.district || "-"}</td>
                <td className="px-2 py-1">{r.district_source || "-"}</td>
                <td className="px-2 py-1">{Math.round(r.location_confidence || 0)}</td>
                <td className="px-2 py-1">{r.price_eur ?? "-"}</td>
                <td className="px-2 py-1">{r.area_sqm ?? "-"}</td>
                <td className="px-2 py-1">{r.rooms ?? "-"}</td>
                <td className="px-2 py-1">{r.price_per_sqm ?? "-"}</td>
                <td className="px-2 py-1">{r.cluster_id || "-"}</td>
                <td className="px-2 py-1">{r.geo_status || "-"}</td>
                <td className="px-2 py-1 max-w-[220px] truncate">{r.quality_flags || "-"}</td>
                <td className="px-2 py-1 max-w-[260px] truncate"><a className="underline" href={r.url} target="_blank">open</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
