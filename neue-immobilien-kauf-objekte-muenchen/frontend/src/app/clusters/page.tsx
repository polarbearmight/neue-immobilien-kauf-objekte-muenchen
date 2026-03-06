import { getClusters } from "@/lib/api";

export default async function ClustersPage() {
  const clusters = await getClusters();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
      <div className="space-y-3">
        {clusters.map((c) => (
          <div key={c.cluster_id} className="rounded-xl border p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">Cluster {c.cluster_id} · {c.members_count} Quellen</p>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-xs" title="Manual override coming soon">Merge</button>
                <button className="rounded border px-2 py-1 text-xs" title="Manual override coming soon">Split</button>
              </div>
            </div>
            <ul className="space-y-1 text-muted-foreground">
              {c.members.map((m, idx) => {
                const key = m.id != null ? `listing-${m.id}` : `${c.cluster_id}-${m.source}-${m.source_listing_id || m.url || idx}`;
                return (
                  <li key={key}>
                    {m.source}: <a href={m.url} target="_blank" rel="noreferrer" className="underline">{m.title || "Ohne Titel"}</a>
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
