"use client";
import { useEffect, useMemo, useState } from "react";
import { API_URL, authHeaders } from "@/lib/api";

type Row = { id: number; source: string; display_title?: string; district?: string; postal_code?: string; latitude?: number; longitude?: number; geo_status?: string; map_mode_assignment?: string; location_confidence?: number; district_source?: string };

export default function GeoDebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [onlyMissingCoords, setOnlyMissingCoords] = useState(false);
  const refresh = async () => {
    const r = await fetch(`${API_URL}/api/geo-debug?limit=500`, { cache: "no-store", headers: authHeaders() });
    setRows((await r.json()) || []);
  };

  useEffect(() => {
    let cancelled = false;

    const fetchRows = async () => {
      const r = await fetch(`${API_URL}/api/geo-debug?limit=500`, { cache: "no-store", headers: authHeaders() });
      const data = (await r.json()) || [];
      if (!cancelled) setRows(data);
    };

    void fetchRows();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissingCoords && !(r.latitude == null || r.longitude == null)) return false;
      if (!q) return true;
      return `${r.source} ${r.display_title || ""} ${r.district || ""} ${r.postal_code || ""} ${r.geo_status || ""} ${r.map_mode_assignment || ""}`.toLowerCase().includes(q);
    });
  }, [rows, query, onlyMissingCoords]);

  return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Geo Debug</h1>
    <div className="rounded border p-3 text-sm flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1"><span className="mb-1 block text-muted-foreground">Search</span><input className="w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel, District, Geo-Status…" /></label><label className="flex items-center gap-2 pb-1"><input type="checkbox" checked={onlyMissingCoords} onChange={(e) => setOnlyMissingCoords(e.target.checked)} /><span>Only missing coords</span></label><button className="rounded border px-2 py-1" onClick={refresh}>Refresh</button><span className="text-xs text-muted-foreground">{filtered.length} Treffer</span></div>
    <div className="overflow-x-auto rounded border"><table className="w-full text-xs"><thead><tr className="border-b"><th className="px-2 py-1">source</th><th className="px-2 py-1">title</th><th className="px-2 py-1">district</th><th className="px-2 py-1">postal</th><th className="px-2 py-1">lat</th><th className="px-2 py-1">lon</th><th className="px-2 py-1">geo</th><th className="px-2 py-1">map_mode</th><th className="px-2 py-1">conf</th></tr></thead>
      <tbody>{filtered.map((r)=><tr key={r.id} className="border-b"><td className="px-2 py-1">{r.source}</td><td className="px-2 py-1">{r.display_title||"-"}</td><td className="px-2 py-1">{r.district||"-"}</td><td className="px-2 py-1">{r.postal_code||"-"}</td><td className="px-2 py-1">{r.latitude??"-"}</td><td className="px-2 py-1">{r.longitude??"-"}</td><td className="px-2 py-1">{r.geo_status||"-"}</td><td className="px-2 py-1">{r.map_mode_assignment||"-"}</td><td className="px-2 py-1">{Math.round(r.location_confidence||0)}</td></tr>)}</tbody></table></div>
  </div>;
}
