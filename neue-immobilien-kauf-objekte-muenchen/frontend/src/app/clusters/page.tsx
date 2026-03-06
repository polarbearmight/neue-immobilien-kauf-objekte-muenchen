import { getClusters } from "@/lib/api";

export default async function ClustersPage() {
  const clusters = await getClusters();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
      <div className="space-y-3">
        {clusters.map((c) => (
          <div key={c.cluster_id} className="rounded-xl border p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium">Cluster {c.cluster_id} · {c.members_count} Listings · {c.sources?.length || 0} Quellen</p>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-xs" title="Manual override coming soon">Merge</button>
                <button className="rounded border px-2 py-1 text-xs" title="Manual override coming soon">Split</button>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">Seen on: {(c.sources || []).join(", ") || "-"}</p>
            {c.canonical ? (
              <p className="mb-2 text-xs">
                Canonical: <a href={c.canonical.url} target="_blank" rel="noreferrer" className="underline">{c.canonical.title || "Ohne Titel"}</a>
              </p>
            ) : null}
            <ul className="space-y-1 text-muted-foreground">
              {c.members.map((m, idx) => {
                const key = m.id != null ? `listing-${m.id}` : `${c.cluster_id}-${m.source}-${m.source_listing_id || m.url || idx}`;
                const isCanonical = c.canonical_listing_id != null && m.id === c.canonical_listing_id;
                return (
                  <li key={key}>
                    {m.source}: <a href={m.url} target="_blank" rel="noreferrer" className="underline">{m.title || "Ohne Titel"}</a>
                    {isCanonical ? <span className="ml-2 rounded border px-1 py-0.5 text-[10px]">canonical</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
