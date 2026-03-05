import { getSources } from "@/lib/api";

export default async function SourcesPage() {
  const sources = await getSources();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.name} className="rounded-lg border p-3 text-sm">
            {s.name} · {s.health_status} · Reliability {s.reliability_score ?? "-"}
          </li>
        ))}
      </ul>
    </div>
  );
}
