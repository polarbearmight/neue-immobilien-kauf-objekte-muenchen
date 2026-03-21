"use client";

import { useEffect, useState } from "react";
import { Activity, Gauge, Layers3, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { API_URL, authHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";

type Source = { id: number; name: string; health_status: string; reliability_score?: number; approved: boolean; enabled: boolean; last_error?: string };
type SourceRun = { id: number; started_at: string; status: string; new_count: number; updated_count: number; notes?: string };
type DistrictQuality = { total: number; assigned_pct: number; coordinates_pct: number; postal_code_pct: number; title_only_pct: number; unknown_pct: number };
type SourceQualityRow = { count: number; missing_title: number; missing_district: number; missing_postal_code: number; missing_address: number; missing_price: number; missing_area: number; missing_rooms: number; missing_coords: number; invalid_url: number; unknown_location: number; duplicate_clustered_pct?: number; parse_error_count?: number; usable_price_pct?: number; usable_sqm_pct?: number };

function healthTone(status: string) {
  if (status === "healthy") return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/14 dark:text-emerald-100";
  if (status === "blocked") return "border-red-300 bg-red-100 text-red-900 dark:border-red-400/30 dark:bg-red-500/14 dark:text-red-100";
  return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/34 dark:bg-amber-400/14 dark:text-amber-100";
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [runsBySource, setRunsBySource] = useState<Record<number, SourceRun[]>>({});
  const [quality, setQuality] = useState<DistrictQuality | null>(null);
  const [sourceQuality, setSourceQuality] = useState<Record<string, SourceQualityRow>>({});
  const [runningSourceName, setRunningSourceName] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`${API_URL}/api/sources`, { cache: "no-store", headers: authHeaders() });
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
      const [qr, sqr] = await Promise.all([
        fetch(`${API_URL}/api/district-quality`, { cache: "no-store" }),
        fetch(`${API_URL}/api/source-quality`, { cache: "no-store" }),
      ]);
      setQuality(await qr.json());
      const sq = await sqr.json();
      setSourceQuality((sq?.by_source || {}) as Record<string, SourceQualityRow>);
    } catch {
      setQuality(null);
      setSourceQuality({});
    }
  };

  useEffect(() => { load(); }, []);

  const selfTest = async (id: number) => {
    await fetch(`${API_URL}/api/sources/${id}/self-test`, { method: "POST" });
    load();
  };

  const toggle = async (id: number, enabled: boolean) => {
    await fetch(`${API_URL}/api/sources/${id}/enable?enabled=${String(enabled)}`, { method: "POST" });
    load();
  };

  const runSourceNow = async (sourceName: string) => {
    setRunningSourceName(sourceName);
    setRunNotice(null);
    try {
      const res = await fetch(`${API_URL}/api/collect/run?source=${encodeURIComponent(sourceName)}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        setRunNotice(`Run failed for ${sourceName}`);
        return;
      }
      const summary = Array.isArray(data?.summary) ? data.summary[0] : null;
      if (summary?.status === "ok") {
        setRunNotice(`${sourceName} run finished: +${summary.new ?? 0} new / ~${summary.updated ?? 0} updated`);
      } else {
        setRunNotice(`${sourceName} run finished with status: ${summary?.status ?? "unknown"}`);
      }
      await load();
    } catch {
      setRunNotice(`Run failed for ${sourceName}`);
    } finally {
      setRunningSourceName(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-amber-400/20 dark:bg-[radial-gradient(circle_at_top,rgba(245,197,66,0.12),rgba(10,12,16,0.96)_34%,rgba(10,12,16,0.99)_100%)] dark:shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Source Control
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Sources im Premium-Dark-Health-Look</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-[15px] dark:text-amber-100/72">
              Health, Runs, Quality und manuelle Aktionen bleiben auf Mobile jetzt konsistent mit dem Dark/Gold-Schema des Deal Radar.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/60">Quellen</div>
              <div className="mt-2 text-xl font-semibold dark:text-amber-50">{sources.length}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/60">Healthy</div>
              <div className="mt-2 text-xl font-semibold dark:text-amber-50">{sources.filter((s) => s.health_status === "healthy").length}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/60">Approved</div>
              <div className="mt-2 text-xl font-semibold dark:text-amber-50">{sources.filter((s) => s.approved).length}</div>
            </div>
            <div className="rounded-[1.4rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/15 dark:bg-white/[0.03]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/60">Enabled</div>
              <div className="mt-2 text-xl font-semibold dark:text-amber-50">{sources.filter((s) => s.enabled).length}</div>
            </div>
          </div>
        </div>
      </section>

      {runNotice ? <div className="rounded-2xl border border-border bg-card px-4 py-2 text-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">{runNotice}</div> : null}

      {quality ? (
        <section className="grid gap-3 rounded-[1.75rem] border border-border/80 bg-card/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)] dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(30,24,15,0.92),rgba(10,12,16,0.98))] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {([
            ["Total Listings", quality.total, Layers3],
            ["Assigned", `${quality.assigned_pct}%`, ShieldCheck],
            ["Coordinates", `${quality.coordinates_pct}%`, Activity],
            ["Postal code", `${quality.postal_code_pct}%`, Gauge],
            ["Title only", `${quality.title_only_pct}%`, Layers3],
            ["Unknown", `${quality.unknown_pct}%`, Activity],
          ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-[1.3rem] border border-border/70 bg-background/75 px-4 py-3 dark:border-amber-400/14 dark:bg-white/[0.03]">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground dark:text-amber-100/60">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-2 text-lg font-semibold dark:text-amber-50">{value}</div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="space-y-3">
        {sources.map((s) => {
          const sq = sourceQuality[s.name];
          return (
            <section key={s.id} className="rounded-[1.75rem] border border-border/80 bg-card/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)] dark:border-amber-400/16 dark:bg-[linear-gradient(180deg,rgba(30,24,15,0.92),rgba(10,12,16,0.98))] dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold dark:text-amber-50">{s.name}</p>
                    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]", healthTone(s.health_status))}>{s.health_status}</span>
                    <span className="inline-flex rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground dark:border-amber-400/16 dark:bg-white/[0.03] dark:text-amber-100/72">
                      Reliability {s.reliability_score ?? "-"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground dark:text-amber-100/72">
                    approved={String(s.approved)} · enabled={String(s.enabled)}
                  </p>
                  {s.last_error ? <p className="mt-2 text-xs text-destructive dark:text-red-200">{s.last_error}</p> : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.03]">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60">Recent runs</div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground dark:text-amber-100/72">
                        {(runsBySource[s.id] || []).length ? (runsBySource[s.id] || []).map((r) => (
                          <p key={r.id}>{new Date(r.started_at).toLocaleString("de-DE")} · {r.status} · +{r.new_count}/~{r.updated_count}</p>
                        )) : <p>No recent runs</p>}
                      </div>
                    </div>

                    {sq ? (
                      <>
                        <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.03]">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60">Data quality</div>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground dark:text-amber-100/72">
                            <p>active={sq.count} · missing title={sq.missing_title} · missing district={sq.missing_district}</p>
                            <p>missing postal={sq.missing_postal_code} · missing address={sq.missing_address}</p>
                            <p>missing coords={sq.missing_coords} · invalid url={sq.invalid_url}</p>
                          </div>
                        </div>
                        <div className="rounded-[1.2rem] border border-border/70 bg-background/75 px-3 py-3 dark:border-amber-400/14 dark:bg-white/[0.03]">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground dark:text-amber-100/60">Pipeline health</div>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground dark:text-amber-100/72">
                            <p>unknown location={sq.unknown_location} · parse errors={sq.parse_error_count ?? 0}</p>
                            <p>dup clustered={sq.duplicate_clustered_pct ?? 0}%</p>
                            <p>usable price={sq.usable_price_pct ?? 0}% · usable sqm={sq.usable_sqm_pct ?? 0}%</p>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:w-[280px]">
                  <button className="rounded-2xl border border-border px-3 py-2 text-sm font-medium dark:border-amber-400/16 dark:bg-white/[0.03] dark:text-amber-50" onClick={() => selfTest(s.id)}>Self-test</button>
                  {s.name === "kleinanzeigen" ? (
                    <button
                      className="rounded-2xl border border-border px-3 py-2 text-sm font-medium dark:border-amber-400/16 dark:bg-white/[0.03] dark:text-amber-50"
                      onClick={() => runSourceNow(s.name)}
                      disabled={runningSourceName === s.name}
                      title="Runs only this source immediately"
                    >
                      {runningSourceName === s.name ? "Running…" : "Run now"}
                    </button>
                  ) : null}
                  <button className="rounded-2xl border border-border px-3 py-2 text-sm font-medium dark:border-amber-400/16 dark:bg-white/[0.03] dark:text-amber-50" onClick={async () => { await fetch(`${API_URL}/api/sources/${s.id}/approve?approved=${String(!s.approved)}`, { method: "POST" }); load(); }}>{s.approved ? "Unapprove" : "Approve"}</button>
                  <button className="rounded-2xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground dark:border dark:border-amber-300/30 dark:bg-amber-300 dark:text-[#1a1408]" onClick={() => toggle(s.id, !s.enabled)}>{s.enabled ? "Disable" : "Enable"}</button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
