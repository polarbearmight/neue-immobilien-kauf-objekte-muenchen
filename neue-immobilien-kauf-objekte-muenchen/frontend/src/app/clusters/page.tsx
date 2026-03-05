import { getClusters } from "@/lib/api";

export default async function ClustersPage() {
  const clusters = await getClusters();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
      <ul className="space-y-2">
        {clusters.map((c) => (
          <li key={c.cluster_id} className="rounded-lg border p-3 text-sm">
            Cluster {c.cluster_id} · {c.members_count} Einträge
          </li>
        ))}
      </ul>
    </div>
  );
}
