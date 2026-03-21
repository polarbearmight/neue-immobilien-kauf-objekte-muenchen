"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

type Cluster = { cluster_id: string; members_count: number; members: Array<{ id: number; source: string; display_title?: string; price_eur?: number; area_sqm?: number; district?: string; url: string }> };

export default function DuplicateDebugPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Cluster[]>([]);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    const r = await fetch(`${API_URL}/api/duplicate-debug?limit=500`, { cache: "no-store" });
    setRows((await r.json()) || []);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.is_demo) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const fetchRows = async () => {
      const r = await fetch(`${API_URL}/api/duplicate-debug?limit=500`, { cache: "no-store" });
      const data = (await r.json()) || [];
      if (!cancelled) setRows(data);
    };

    void fetchRows();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => `${c.cluster_id} ${c.members.map((m) => `${m.source} ${m.display_title || ""} ${m.district || ""}`).join(" ")}`.toLowerCase().includes(q));
  }, [rows, query]);

  return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Duplicate Debug</h1>
    <div className="rounded border p-3 text-sm flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1"><span className="mb-1 block text-muted-foreground">Search</span><input className="w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cluster, Source, Titel, District…" /></label><button className="rounded border px-2 py-1" onClick={refresh}>Refresh</button><span className="text-xs text-muted-foreground">{filtered.length} Treffer</span></div>
    {filtered.map((c) => <div key={c.cluster_id} className="rounded border p-3 text-xs">
      <p className="font-medium">{c.cluster_id} · {c.members_count} members</p>
      {c.members.map((m) => <p key={m.id}>{m.source} · {m.display_title || "-"} · {m.price_eur ?? "-"}€ · {m.area_sqm ?? "-"}m² · {m.district || "-"}</p>)}
    </div>)}
  </div>;
}
