import { getClusters } from "@/lib/api";

export default async function ClustersPage() {
  const clusters = await getClusters();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
      <div className="space-y-3">
        {clusters.map((c) => (
          <div key={c.cluster_id} className="rounded-xl border p-4 text-sm">
            <p className="mb-2 font-medium">Cluster {c.cluster_id} · {c.members_count} Quellen</p>
            <ul className="space-y-1 text-muted-foreground">
              {c.members.map((m) => (
                <li key={`${m.source}-${m.source_listing_id}`}>
                  {m.source}: <a href={m.url} target="_blank" rel="noreferrer" className="underline">{m.title || "Ohne Titel"}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
