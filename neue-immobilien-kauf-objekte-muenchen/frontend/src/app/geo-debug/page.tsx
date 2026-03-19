"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type Row = {
  id: number;
  source: string;
  display_title?: string;
  district?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  geo_status?: string;
  map_mode_assignment?: string;
  location_confidence?: number;
  district_source?: string;
};

export default function GeoDebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [onlyMissingCoords, setOnlyMissingCoords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/geo-debug?limit=500`, { cache: "no-store" });
      if (!r.ok) throw new Error("geo_debug_failed");
      setRows((await r.json()) || []);
    } catch {
      setRows([]);
      setError("Geo-Debug-Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyMissingCoords && !(r.latitude == null || r.longitude == null)) return false;
      if (!q) return true;
      return `${r.source} ${r.display_title || ""} ${r.district || ""} ${r.postal_code || ""} ${r.geo_status || ""} ${r.map_mode_assignment || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, onlyMissingCoords]);

  const missingCoordsCount = useMemo(
    () => rows.filter((r) => r.latitude == null || r.longitude == null).length,
    [rows]
  );

  const lowConfidenceCount = useMemo(
    () => rows.filter((r) => (r.location_confidence || 0) < 50).length,
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Geo Debug</h1>
          <p className="text-sm text-muted-foreground">Schneller Blick auf fehlende Koordinaten, Geo-Status und schwache Standort-Sicherheit.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">{rows.length} Zeilen</span>
          <span className="rounded-full border px-3 py-1">{missingCoordsCount} ohne Koordinaten</span>
          <span className="rounded-full border px-3 py-1">{lowConfidenceCount} low confidence</span>
        </div>
      </div>

      {error ? <StateCard title="Geo Debug nicht verfügbar" body={error} tone="error" /> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-3xl border p-3 text-sm">
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-muted-foreground">Search</span>
          <input className="w-full rounded-xl border px-3 py-2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titel, District, Geo-Status…" />
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" checked={onlyMissingCoords} onChange={(e) => setOnlyMissingCoords(e.target.checked)} />
          <span>Nur fehlende Koordinaten</span>
        </label>
        <button className="rounded-xl border px-3 py-2" onClick={() => void load()} disabled={loading}>{loading ? "Lädt…" : "Refresh"}</button>
        <span className="text-xs text-muted-foreground">{filtered.length} Treffer</span>
      </div>

      {loading ? (
        <StateCard title="Geo-Debug wird geladen" body="Die Positionsdaten werden gerade aktualisiert." tone="muted" />
      ) : filtered.length === 0 ? (
        <StateCard title="Keine Treffer" body="Passe Suche oder Filter an, um problematische Geo-Zeilen einzugrenzen." tone="muted" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border">
          <table className="w-full min-w-[980px] text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2">source</th>
                <th className="px-3 py-2">title</th>
                <th className="px-3 py-2">district</th>
                <th className="px-3 py-2">postal</th>
                <th className="px-3 py-2">lat</th>
                <th className="px-3 py-2">lon</th>
                <th className="px-3 py-2">geo</th>
                <th className="px-3 py-2">map_mode</th>
                <th className="px-3 py-2">district_source</th>
                <th className="px-3 py-2">conf</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const confidence = Math.round(r.location_confidence || 0);
                const weak = r.latitude == null || r.longitude == null || confidence < 50;
                return (
                  <tr key={r.id} className={`border-b ${weak ? "bg-amber-50/60 dark:bg-amber-500/10" : ""}`}>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2">{r.display_title || "-"}</td>
                    <td className="px-3 py-2">{r.district || "-"}</td>
                    <td className="px-3 py-2">{r.postal_code || "-"}</td>
                    <td className="px-3 py-2">{r.latitude ?? "-"}</td>
                    <td className="px-3 py-2">{r.longitude ?? "-"}</td>
                    <td className="px-3 py-2">{r.geo_status || "-"}</td>
                    <td className="px-3 py-2">{r.map_mode_assignment || "-"}</td>
                    <td className="px-3 py-2">{r.district_source || "-"}</td>
                    <td className="px-3 py-2">{confidence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
