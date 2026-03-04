"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Listing = {
  source: string;
  source_listing_id: string;
  url: string;
  title?: string;
  description?: string;
  image_url?: string;
  price_eur?: number;
  price_per_sqm?: number;
  area_sqm?: number;
  rooms?: number;
  posted_at?: string;
  first_seen_at: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

function eur(v?: number) {
  if (v === undefined || v === null) return "-";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

export default function Home() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [limit, setLimit] = useState("20");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/listings?bucket=${bucket}&sort=newest&limit=200`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [bucket]);

  const pageItems = useMemo(() => items.slice(0, Number(limit)), [items, limit]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Immobilien Finder München</h1>
            <p className="text-slate-600">shadcn/ui Frontend · neueste Treffer konsolidiert</p>
          </div>
          <div className="flex gap-3">
            <div className="w-44">
              <label className="mb-1 block text-xs text-slate-500">Preis/m² Bucket</label>
              <Select value={bucket} onValueChange={setBucket}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="9000">≤ 9.000</SelectItem>
                  <SelectItem value="12000">≤ 12.000</SelectItem>
                  <SelectItem value="unknown">Unbekannt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="mb-1 block text-xs text-slate-500">Pro Seite</label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <p>Lade Treffer…</p>
        ) : pageItems.length === 0 ? (
          <p>Keine Treffer gefunden.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((item) => (
              <Card key={`${item.source}-${item.source_listing_id}`} className="overflow-hidden border-slate-200 bg-white">
                <div className="aspect-[16/10] w-full bg-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url || "https://placehold.co/800x500?text=Kein+Bild"}
                    alt={item.title || "Objektbild"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{item.source.toUpperCase()}</Badge>
                    <span className="text-xs text-slate-500">{new Date(item.first_seen_at).toLocaleDateString("de-DE")}</span>
                  </div>
                  <a href={item.url} target="_blank" className="line-clamp-2 text-base font-semibold hover:underline" rel="noreferrer">
                    {item.title || "Ohne Titel"}
                  </a>
                  <p className="line-clamp-2 text-sm text-slate-600">{item.description || "Keine Beschreibung verfügbar."}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Kaufpreis</span><div className="font-medium">{eur(item.price_eur)}</div></div>
                    <div><span className="text-slate-500">€/m²</span><div className="font-medium">{eur(item.price_per_sqm)}</div></div>
                    <div><span className="text-slate-500">Fläche</span><div className="font-medium">{item.area_sqm ? `${item.area_sqm} m²` : "-"}</div></div>
                    <div><span className="text-slate-500">Zimmer</span><div className="font-medium">{item.rooms ?? "-"}</div></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
