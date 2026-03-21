"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type Cluster = {
  cluster_id: string;
  members_count: number;
  members: Array<{ id: number; source: string; display_title?: string; price_eur?: number; area_sqm?: number; district?: string; url: string }>;
};

export default function DuplicateDebugPage() {
  const [rows, setRows] = useState<Cluster[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/duplicate-debug?limit=500`, { cache: "no-store" });
      if (!r.ok) throw new Error("duplicate_debug_failed");
      setRows((await r.json()) || []);
    } catch {
      setRows([]);
      setError("Duplicate-Debug-Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => `${c.cluster_id} ${c.members.map((m) => `${m.source} ${m.display_title || ""} ${m.district || ""}`).join(" ")}`.toLowerCase().includes(q));
  }, [rows, query]);

  const duplicateMembers = useMemo(
    () => rows.reduce((sum, cluster) => sum + cluster.members_count, 0),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplicate Debug</h1>
          <p className="text-sm text-muted-foreground">Cluster schnell durchsuchen und offensichtliche Duplikat-Gruppen verifizieren.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">{rows.length} Cluster</span>
          <span className="rounded-full border px-3 py-1">{duplicateMembers} Mitglieder</span>
          <span className="rounded-full border px-3 py-1">{filtered.length} Treffer</span>
        </div>
      </div>

      {error ? <StateCard title="Duplicate Debug nicht verfügbar" body={error} tone="error" /> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-3xl border p-3 text-sm">
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-muted-foreground">Search</span>
          <input className="w-full rounded-xl border px-3 py-2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cluster, Source, Titel, District…" />
        </label>
        <button className="rounded-xl border px-3 py-2" onClick={() => void load()} disabled={loading}>{loading ? "Lädt…" : "Refresh"}</button>
      </div>

      {loading ? (
        <StateCard title="Duplicate-Debug wird geladen" body="Die Cluster werden gerade vom Backend geholt." tone="muted" />
      ) : filtered.length === 0 ? (
        <StateCard title="Keine Treffer" body="Mit der aktuellen Suche wurden keine Cluster gefunden." tone="muted" />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.cluster_id} className="rounded-3xl border p-4 text-xs">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="font-medium">{c.cluster_id}</p>
                <span className="text-muted-foreground">{c.members_count} members</span>
              </div>
              <div className="mt-3 space-y-2">
                {c.members.map((m) => (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block rounded-2xl border px-3 py-2 hover:bg-muted/40">
                    <p className="font-medium">{m.display_title || "-"}</p>
                    <p className="text-muted-foreground">{m.source} · {m.district || "-"}</p>
                    <p className="text-muted-foreground">{m.price_eur ?? "-"}€ · {m.area_sqm ?? "-"}m²</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
