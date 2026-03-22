"use client";

import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "@/lib/api";
import { RoleBanner } from "@/components/role-banner";
import { RoleGuard } from "@/components/role-guard";

type Source = { id: number; name: string; health_status: string; reliability_score?: number; approved: boolean; enabled: boolean; last_error?: string };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`${API_URL}/api/sources`, { cache: "no-store", headers: authHeaders() });
    const rows = await r.json().catch(() => []);
    setSources(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, []);

  const toggle = async (id: number, enabled: boolean) => {
    const r = await fetch(`${API_URL}/api/sources/${id}/enable?enabled=${String(enabled)}`, { method: "POST", headers: authHeaders() });
    setNotice(r.ok ? `Source ${enabled ? "aktiviert" : "deaktiviert"}.` : "Source konnte nicht geändert werden.");
    await load();
  };

  return (
    <RoleGuard minRole="admin">
      <div className="space-y-4 md:space-y-5">
        <RoleBanner role="admin" title="Admin area" body="Sources, Source Health und Schaltvorgänge sind nur für Admin sichtbar." />
        <section className="rounded-[1.8rem] border border-border/80 bg-card/95 p-5 dark:border-amber-400/16 dark:bg-[rgba(10,12,16,0.94)]">
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-2 text-sm text-muted-foreground">Admin-Ansicht für Quellen, Health und Enable/Disable.</p>
          {notice ? <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">{notice}</div> : null}
        </section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="rounded-[1.5rem] border border-border/80 bg-card/95 p-4 text-sm dark:border-amber-400/16 dark:bg-[rgba(10,12,16,0.94)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">health: {s.health_status} · reliability: {Math.round(s.reliability_score || 0)}</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]">{s.enabled ? "enabled" : "disabled"}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">approved: {String(s.approved)}{s.last_error ? ` · last error: ${s.last_error}` : ""}</p>
              <div className="mt-4 flex gap-2">
                <button className="rounded-2xl border px-3 py-2" onClick={() => toggle(s.id, !s.enabled)}>{s.enabled ? "Disable" : "Enable"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
