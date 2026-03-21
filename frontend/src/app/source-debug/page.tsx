"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);

  const refresh = async () => {
    const q = new URLSearchParams({ limit: "500" });
    if (source !== "all") q.set("source", source);
    const r = await fetch(`${API_URL}/api/source-debug?${q.toString()}`, { cache: "no-store" });
    setRows((await r.json()) || []);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.is_demo) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const fetchRows = async () => {
      const q = new URLSearchParams({ limit: "500" });
      if (source !== "all") q.set("source", source);
      const r = await fetch(`${API_URL}/api/source-debug?${q.toString()}`, { cache: "no-store" });
      const data = (await r.json()) || [];
      if (!cancelled) setRows(data);
    };

    void fetchRows();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const sources = useMemo(() => ["all", ...Array.from(new Set(rows.map((x) => x.source))).sort()], [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyProblems && !(r.district_source === "unknown" || (r.location_confidence || 0) < 40 || Boolean(r.quality_flags))) return false;
      if (!q) return true;
      return `${r.source} ${r.raw_title || ""} ${r.display_title || ""} ${r.raw_address || ""} ${r.raw_district_text || ""} ${r.district || ""} ${r.postal_code || ""} ${r.quality_flags || ""}`.toLowerCase().includes(q);
    });
  }, [rows, query, onlyProblems]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Source Debug</h1>
      <div className="rounded border p-3 text-sm flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-muted-foreground">Source</span>
          <select className="rounded border px-2 py-1" value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-muted-foreground">Search</span>
          <input className="w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel, Adresse, Flags…" />
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          <span>Only problem cases</span>
        </label>
        <button className="rounded border px-2 py-1" onClick={refresh}>Refresh</button>
        <span className="text-xs text-muted-foreground">{filtered.length} Treffer</span>
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
            {filtered.map((r) => (
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
