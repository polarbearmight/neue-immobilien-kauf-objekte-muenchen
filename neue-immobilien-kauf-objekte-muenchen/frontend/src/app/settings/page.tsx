"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Rule = { id: number; name: string; district?: string; min_score?: number; max_price?: number; min_sqm?: number; bucket?: string; enabled: boolean };

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");

  const load = async () => {
    const r = await fetch(`${API_URL}/api/alert-rules`, { cache: "no-store" });
    setRules(await r.json());
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const createRule = async () => {
    if (!name.trim()) return;
    await fetch(`${API_URL}/api/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled: true }),
    });
    setName("");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Alert Rule Builder (MVP)</p>
        <div className="flex gap-2">
          <input className="w-full rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
          <button className="rounded border px-3 py-2 text-sm" onClick={createRule}>Create</button>
        </div>
      </div>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 text-sm">
            {r.name} · enabled={String(r.enabled)}
          </div>
        ))}
      </div>
    </div>
  );
}
