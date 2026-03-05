"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Source = { id: number; name: string; health_status: string; reliability_score?: number; approved: boolean; enabled: boolean; last_error?: string };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);

  const load = async () => {
    const r = await fetch(`${API_URL}/api/sources`, { cache: "no-store" });
    setSources(await r.json());
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
