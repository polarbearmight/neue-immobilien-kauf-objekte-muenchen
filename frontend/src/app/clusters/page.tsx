"use client";

import { useEffect, useState } from "react";
import { API_URL, authHeaders, type Listing } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type Cluster = {
  cluster_id: string;
  members_count: number;
  sources?: string[];
  canonical_listing_id?: number;
  canonical?: Listing;
  members: Listing[];
};

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/clusters`, { cache: "no-store", headers: authHeaders() });
        if (!res.ok) throw new Error(`clusters_${res.status}`);
        setClusters(await res.json());
      } catch {
        setClusters([]);
        setError("Cluster konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <StateCard title="Clusters werden geladen" body="Cluster und Quellenbeziehungen werden vorbereitet." tone="muted" />;
  if (error) return <StateCard title="Clusters nicht verfügbar" body={error} tone="error" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
      {clusters.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">Keine Cluster gefunden.</div>
      ) : (
        <div className="space-y-3">
          {clusters.map((c) => (
            <div key={c.cluster_id} className="rounded-xl border p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">Cluster {c.cluster_id} · {c.members_count} Listings · {c.sources?.length || 0} Quellen</p>
                <div className="flex gap-2">
                  <button disabled className="cursor-not-allowed rounded border px-2 py-1 text-xs opacity-50" title="Manual override kommt später">Merge</button>
                  <button disabled className="cursor-not-allowed rounded border px-2 py-1 text-xs opacity-50" title="Manual override kommt später">Split</button>
                </div>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">Seen on: {(c.sources || []).join(", ") || "-"}</p>
              {c.canonical ? (
                <p className="mb-2 text-xs">
                  Canonical: <a href={c.canonical.url} target="_blank" rel="noreferrer" className="underline">{c.canonical.display_title || c.canonical.title || "Ohne Titel"}</a>
                </p>
              ) : null}
              <ul className="space-y-1 text-muted-foreground">
                {c.members.map((m, idx) => {
                  const key = m.id != null ? `listing-${m.id}` : `${c.cluster_id}-${m.source}-${m.source_listing_id || m.url || idx}`;
                  const isCanonical = c.canonical_listing_id != null && m.id === c.canonical_listing_id;
                  return (
                    <li key={key}>
                      {m.source}: <a href={m.url} target="_blank" rel="noreferrer" className="underline">{m.display_title || m.title || "Ohne Titel"}</a>
                      {isCanonical ? <span className="ml-2 rounded border px-1 py-0.5 text-[10px]">canonical</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
