"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Cluster = { cluster_id: string; members_count: number; members: Array<{ id: number; source: string; display_title?: string; price_eur?: number; area_sqm?: number; district?: string; url: string }> };

export default function DuplicateDebugPage() {
  const [rows, setRows] = useState<Cluster[]>([]);
  const load = async () => {
    const r = await fetch(`${API_URL}/api/duplicate-debug?limit=500`, { cache: "no-store" });
    setRows((await r.json()) || []);
  };
  useEffect(() => { load(); }, []);

  return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Duplicate Debug</h1>
    {rows.map((c) => <div key={c.cluster_id} className="rounded border p-3 text-xs">
      <p className="font-medium">{c.cluster_id} · {c.members_count} members</p>
      {c.members.map((m) => <p key={m.id}>{m.source} · {m.display_title || "-"} · {m.price_eur ?? "-"}€ · {m.area_sqm ?? "-"}m² · {m.district || "-"}</p>)}
    </div>)}
  </div>;
}
