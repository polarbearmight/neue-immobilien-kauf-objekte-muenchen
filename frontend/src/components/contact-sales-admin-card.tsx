"use client";

import { useEffect, useState } from "react";
import { StateCard } from "@/components/state-card";

type Lead = { id: number; name: string; email: string; company?: string | null; message: string; status: string; created_at: string };

export function ContactSalesAdminCard() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/contact-leads", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setItems(json?.items || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StateCard title="Kontaktanfragen werden geladen" body="Die letzten Leads werden vorbereitet." tone="muted" />;
  if (!items.length) return <StateCard title="Noch keine Leads" body="Sobald Contact-Sales-Anfragen eingehen, erscheinen sie hier im Überblick." tone="muted" />;

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Neueste Contact-Sales-Leads</h2>
      <div className="mt-4 space-y-3">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-2xl border p-4 text-sm">
            <p className="font-medium">{item.name} · {item.email}</p>
            <p className="text-muted-foreground">{item.company || "Ohne Firma"} · {new Date(item.created_at).toLocaleString("de-DE")}</p>
            <p className="mt-2 line-clamp-3">{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
