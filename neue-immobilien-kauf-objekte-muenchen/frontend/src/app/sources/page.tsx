"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Source = { id: number; name: string; health_status: string; reliability_score?: number; approved: boolean; enabled: boolean; last_error?: string };
type SourceRun = { id: number; started_at: string; status: string; new_count: number; updated_count: number; notes?: string };
type DistrictQuality = { total: number; assigned_pct: number; coordinates_pct: number; postal_code_pct: number; title_only_pct: number; unknown_pct: number };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [runsBySource, setRunsBySource] = useState<Record<number, SourceRun[]>>({});
  const [quality, setQuality] = useState<DistrictQuality | null>(null);

  const load = async () => {
    const r = await fetch(`${API_URL}/api/sources`, { cache: "no-store" });
    const srcRows: Source[] = await r.json();
    setSources(srcRows);

    const entries = await Promise.all(
      srcRows.map(async (s) => {
        try {
          const rr = await fetch(`${API_URL}/api/sources/${s.id}/runs?limit=3`, { cache: "no-store" });
          const rows = await rr.json();
          return [s.id, Array.isArray(rows) ? rows : []] as const;
        } catch {
          return [s.id, []] as const;
        }
      })
    );
    setRunsBySource(Object.fromEntries(entries));

    try {
      const qr = await fetch(`${API_URL}/api/district-quality`, { cache: "no-store" });
      setQuality(await qr.json());
    } catch {
      setQuality(null);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const selfTest = async (id: number) => {
    await fetch(`${API_URL}/api/sources/${id}/self-test`, { method: "POST" });
    load();
  };

  const toggle = async (id: number, enabled: boolean) => {
    await fetch(`${API_URL}/api/sources/${id}/enable?enabled=${String(enabled)}`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>

      {quality ? (
        <div className="grid gap-3 rounded-xl border p-3 text-xs md:grid-cols-3 xl:grid-cols-6">
          <p>Total: <strong>{quality.total}</strong></p>
          <p>Assigned: <strong>{quality.assigned_pct}%</strong></p>
          <p>Coordinates: <strong>{quality.coordinates_pct}%</strong></p>
          <p>Postal code: <strong>{quality.postal_code_pct}%</strong></p>
          <p>Title only: <strong>{quality.title_only_pct}%</strong></p>
          <p>Unknown: <strong>{quality.unknown_pct}%</strong></p>
        </div>
      ) : null}

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground">
                  <span className={`mr-2 inline-block rounded px-2 py-0.5 text-xs ${s.health_status === "healthy" ? "bg-green-100 text-green-700" : s.health_status === "blocked" ? "bg-red-100 text-red-700" : "bg-muted"}`}>{s.health_status}</span>
                  Reliability {s.reliability_score ?? "-"} · approved={String(s.approved)} · enabled={String(s.enabled)}
                </p>
                {s.last_error ? <p className="text-xs text-destructive">{s.last_error}</p> : null}
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {(runsBySource[s.id] || []).map((r) => (
                    <p key={r.id}>{new Date(r.started_at).toLocaleString("de-DE")} · {r.status} · +{r.new_count}/~{r.updated_count}</p>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1" onClick={() => selfTest(s.id)}>Self-test</button>
                <button className="rounded border px-2 py-1" onClick={async () => { await fetch(`${API_URL}/api/sources/${s.id}/approve?approved=${String(!s.approved)}`, { method: "POST" }); load(); }}>{s.approved ? "Unapprove" : "Approve"}</button>
                <button className="rounded border px-2 py-1" onClick={() => toggle(s.id, !s.enabled)}>{s.enabled ? "Disable" : "Enable"}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
