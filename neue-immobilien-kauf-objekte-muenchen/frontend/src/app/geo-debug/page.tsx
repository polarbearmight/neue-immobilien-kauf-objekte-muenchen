"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Row = { id: number; source: string; display_title?: string; district?: string; postal_code?: string; latitude?: number; longitude?: number; geo_status?: string; map_mode_assignment?: string; location_confidence?: number; district_source?: string };

export default function GeoDebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const r = await fetch(`${API_URL}/api/geo-debug?limit=500`, { cache: "no-store" });
    setRows((await r.json()) || []);
  };
  useEffect(() => { load(); }, []);

  return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Geo Debug</h1>
    <div className="overflow-x-auto rounded border"><table className="w-full text-xs"><thead><tr className="border-b"><th className="px-2 py-1">source</th><th className="px-2 py-1">title</th><th className="px-2 py-1">district</th><th className="px-2 py-1">postal</th><th className="px-2 py-1">lat</th><th className="px-2 py-1">lon</th><th className="px-2 py-1">geo</th><th className="px-2 py-1">map_mode</th><th className="px-2 py-1">conf</th></tr></thead>
      <tbody>{rows.map((r)=><tr key={r.id} className="border-b"><td className="px-2 py-1">{r.source}</td><td className="px-2 py-1">{r.display_title||"-"}</td><td className="px-2 py-1">{r.district||"-"}</td><td className="px-2 py-1">{r.postal_code||"-"}</td><td className="px-2 py-1">{r.latitude??"-"}</td><td className="px-2 py-1">{r.longitude??"-"}</td><td className="px-2 py-1">{r.geo_status||"-"}</td><td className="px-2 py-1">{r.map_mode_assignment||"-"}</td><td className="px-2 py-1">{Math.round(r.location_confidence||0)}</td></tr>)}</tbody></table></div>
  </div>;
}
