"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type Rule = { id: number; name: string; enabled: boolean };
type Watch = { id: number; listing: { title?: string; url: string; district?: string; deal_score?: number } };

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [watchlist, setWatchlist] = useState<Watch[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiModifier, setAiModifier] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem("deal-ui-settings");
    return raw ? (JSON.parse(raw).aiModifier ?? true) : true;
  });

  const [brandNewHours, setBrandNewHours] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const raw = localStorage.getItem("deal-ui-settings");
    return raw ? JSON.parse(raw).brandNewHours ?? 6 : 6;
  });
  const [justListedHours, setJustListedHours] = useState<number>(() => {
    if (typeof window === "undefined") return 2;
    const raw = localStorage.getItem("deal-ui-settings");
    return raw ? JSON.parse(raw).justListedHours ?? 2 : 2;
  });
  const [priceDrop, setPriceDrop] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const raw = localStorage.getItem("deal-ui-settings");
    return raw ? JSON.parse(raw).priceDrop ?? 5 : 5;
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rr, wr] = await Promise.all([
        fetch(`${API_URL}/api/alert-rules`, { cache: "no-store" }),
        fetch(`${API_URL}/api/watchlist`, { cache: "no-store" }),
      ]);
      if (!rr.ok || !wr.ok) throw new Error('settings_load_failed');
      setRules(await rr.json());
      setWatchlist(await wr.json());
    } catch {
      setRules([]);
      setWatchlist([]);
      setError("Settings konnten nicht vollständig geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const savePrefs = () => {
    localStorage.setItem("deal-ui-settings", JSON.stringify({ brandNewHours, justListedHours, priceDrop, aiModifier }));
    setNotice("UI preferences lokal gespeichert.");
  };

  const createRule = async () => {
    if (!name.trim()) return;
    await fetch(`${API_URL}/api/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled: true }),
    });
    setName("");
    setNotice("Alert-Regel erstellt.");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {notice ? <p className="rounded border px-3 py-2 text-sm text-muted-foreground">{notice}</p> : null}
      {error ? <StateCard title="Settings unvollständig geladen" body={error} tone="error" /> : null}

      <div className="rounded-xl border p-4 text-sm space-y-3">
        <p className="text-xs text-muted-foreground">Diese UI-Thresholds werden nur lokal im Browser gespeichert und ändern nicht die Backend-Logik.</p>
        <p className="font-medium">Thresholds (UI)</p>
        <label className="block">BRAND_NEW_HOURS: {brandNewHours}<input className="w-full" type="range" min={1} max={24} value={brandNewHours} onChange={(e) => setBrandNewHours(Number(e.target.value))} /></label>
        <label className="block">JUST_LISTED_HOURS: {justListedHours}<input className="w-full" type="range" min={1} max={12} value={justListedHours} onChange={(e) => setJustListedHours(Number(e.target.value))} /></label>
        <label className="block">PRICE_DROP_THRESHOLD: {priceDrop}%<input className="w-full" type="range" min={1} max={20} value={priceDrop} onChange={(e) => setPriceDrop(Number(e.target.value))} /></label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={aiModifier} onChange={(e) => setAiModifier(e.target.checked)} />
          AI Deal Analyzer modifier on/off
        </label>
        <button className="rounded border px-3 py-1" onClick={savePrefs}>Save UI preferences</button>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Alert Rule Builder (MVP)</p>
        <div className="flex gap-2">
          <input className="w-full rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
          <button className="rounded border px-3 py-2 text-sm" onClick={createRule}>Create</button>
        </div>
        <div className="mt-3 space-y-1 text-sm">{rules.map((r) => <div key={r.id}>{r.name} · enabled={String(r.enabled)}</div>)}</div>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Watchlist</p>
        {loading ? <StateCard title="Watchlist wird geladen" body="Die gespeicherten Immobilien werden gerade vorbereitet." tone="muted" /> : watchlist.length === 0 ? <StateCard title="Keine Watchlist-Einträge" body="Sobald du Immobilien merkst, erscheinen sie auch hier in den Settings." tone="muted" /> : <div className="space-y-2 text-sm">
          {watchlist.map((w) => (
            <a key={w.id} href={w.listing.url} target="_blank" rel="noreferrer" className="block rounded border p-2 hover:bg-muted/40">
              {w.listing.title || "Ohne Titel"} · {w.listing.district || "-"} · Score {Math.round(w.listing.deal_score || 0)}
            </a>
          ))}
        </div>}
      </div>
    </div>
  );
}
