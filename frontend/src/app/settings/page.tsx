"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, authHeaders } from "@/lib/api";
import { StateCard } from "@/components/state-card";

type Rule = { id: number; name: string; enabled: boolean };
type Watch = { id: number; listing: { title?: string; url: string; district?: string; deal_score?: number } };
type UiSettings = { aiModifier?: boolean; brandNewHours?: number; justListedHours?: number; priceDrop?: number };

const DEFAULT_UI_SETTINGS: Required<UiSettings> = {
  aiModifier: true,
  brandNewHours: 6,
  justListedHours: 2,
  priceDrop: 5,
};

function readUiSettings(): UiSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("deal-ui-settings");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function SettingsPage() {
  const initial = readUiSettings();
  const [rules, setRules] = useState<Rule[]>([]);
  const [watchlist, setWatchlist] = useState<Watch[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiModifier, setAiModifier] = useState<boolean>(() => initial.aiModifier ?? DEFAULT_UI_SETTINGS.aiModifier);
  const [brandNewHours, setBrandNewHours] = useState<number>(() => initial.brandNewHours ?? DEFAULT_UI_SETTINGS.brandNewHours);
  const [justListedHours, setJustListedHours] = useState<number>(() => initial.justListedHours ?? DEFAULT_UI_SETTINGS.justListedHours);
  const [priceDrop, setPriceDrop] = useState<number>(() => initial.priceDrop ?? DEFAULT_UI_SETTINGS.priceDrop);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rr, wr] = await Promise.all([
        fetch(`${API_URL}/api/alert-rules`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${API_URL}/api/watchlist`, { cache: "no-store", headers: authHeaders() }),
      ]);
      if (!rr.ok || !wr.ok) throw new Error("settings_load_failed");
      setRules(await rr.json());
      setWatchlist(await wr.json());
    } catch {
      setRules([]);
      setWatchlist([]);
      setError("Settings konnten nicht vollständig geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasLocalChanges = useMemo(
    () =>
      aiModifier !== DEFAULT_UI_SETTINGS.aiModifier ||
      brandNewHours !== DEFAULT_UI_SETTINGS.brandNewHours ||
      justListedHours !== DEFAULT_UI_SETTINGS.justListedHours ||
      priceDrop !== DEFAULT_UI_SETTINGS.priceDrop,
    [aiModifier, brandNewHours, justListedHours, priceDrop]
  );

  const savePrefs = () => {
    localStorage.setItem("deal-ui-settings", JSON.stringify({ brandNewHours, justListedHours, priceDrop, aiModifier }));
    setNotice("UI-Präferenzen lokal gespeichert.");
  };

  const resetPrefs = () => {
    localStorage.setItem("deal-ui-settings", JSON.stringify(DEFAULT_UI_SETTINGS));
    setAiModifier(DEFAULT_UI_SETTINGS.aiModifier);
    setBrandNewHours(DEFAULT_UI_SETTINGS.brandNewHours);
    setJustListedHours(DEFAULT_UI_SETTINGS.justListedHours);
    setPriceDrop(DEFAULT_UI_SETTINGS.priceDrop);
    setNotice("UI-Präferenzen auf Standardwerte zurückgesetzt.");
  };

  const createRule = async () => {
    if (!name.trim()) return;
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/alert-rules`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), enabled: true }),
      });
      if (!res.ok) throw new Error("create_rule_failed");
      setName("");
      setNotice("Alert-Regel erstellt.");
      await load();
    } catch {
      setError("Alert-Regel konnte nicht erstellt werden.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Lokale UI-Schwellenwerte, Alert-Regeln und Watchlist an einem Ort.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border px-3 py-1">{rules.length} Regeln</span>
          <span className="rounded-full border px-3 py-1">{watchlist.length} Watchlist</span>
          <span className="rounded-full border px-3 py-1">{hasLocalChanges ? "angepasst" : "Standardwerte"}</span>
        </div>
      </div>

      {notice ? <p className="rounded-2xl border px-3 py-2 text-sm text-muted-foreground">{notice}</p> : null}
      {error ? <StateCard title="Settings unvollständig geladen" body={error} tone="error" /> : null}

      <div className="rounded-3xl border p-4 text-sm space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-medium">Thresholds (nur UI)</p>
            <p className="text-xs text-muted-foreground">Diese Werte werden nur lokal im Browser gespeichert und ändern keine Backend-Logik.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={resetPrefs}>Zurücksetzen</button>
            <button className="rounded-xl border bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={savePrefs}>Speichern</button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block rounded-2xl border p-3">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Brand new</span>
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Neue Listings</span>
              <span>{brandNewHours}h</span>
            </div>
            <input className="w-full" type="range" min={1} max={24} value={brandNewHours} onChange={(e) => setBrandNewHours(Number(e.target.value))} />
          </label>

          <label className="block rounded-2xl border p-3">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Just listed</span>
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Frisch gelistet</span>
              <span>{justListedHours}h</span>
            </div>
            <input className="w-full" type="range" min={1} max={12} value={justListedHours} onChange={(e) => setJustListedHours(Number(e.target.value))} />
          </label>

          <label className="block rounded-2xl border p-3">
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Price drop</span>
            <div className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Preisnachlass</span>
              <span>{priceDrop}%</span>
            </div>
            <input className="w-full" type="range" min={1} max={20} value={priceDrop} onChange={(e) => setPriceDrop(Number(e.target.value))} />
          </label>

          <label className="flex rounded-2xl border p-3">
            <span className="flex flex-1 flex-col justify-between gap-3">
              <span>
                <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">AI modifier</span>
                <span className="block text-sm font-medium">AI Deal Analyzer berücksichtigen</span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aiModifier} onChange={(e) => setAiModifier(e.target.checked)} />
                {aiModifier ? "Aktiv" : "Deaktiviert"}
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="rounded-3xl border p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium">Alert Rule Builder</p>
            <p className="text-xs text-muted-foreground">Schnell eine einfache Regel anlegen. Mehr Logik kann später folgen.</p>
          </div>
          <span className="text-xs text-muted-foreground">{rules.length} aktive/gespeicherte Regeln</span>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Schwabing unter 11.000 €/m²" onKeyDown={(e) => { if (e.key === "Enter") void createRule(); }} />
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={createRule}>Create</button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {rules.length === 0 ? (
            <StateCard title="Noch keine Regeln" body="Lege eine erste Alert-Regel an, damit interessante Konstellationen später schneller auffallen." tone="muted" />
          ) : (
            rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border px-3 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.enabled ? "aktiv" : "inaktiv"}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Watchlist</p>
            <p className="text-xs text-muted-foreground">Gespeicherte Immobilien mit schnellem Absprung zur Quelle.</p>
          </div>
          <button className="rounded-xl border px-3 py-2 text-xs" onClick={() => void load()}>Neu laden</button>
        </div>
        {loading ? (
          <StateCard title="Watchlist wird geladen" body="Die gespeicherten Immobilien werden gerade vorbereitet." tone="muted" />
        ) : watchlist.length === 0 ? (
          <StateCard title="Keine Watchlist-Einträge" body="Sobald du Immobilien merkst, erscheinen sie auch hier in den Settings." tone="muted" />
        ) : (
          <div className="space-y-2 text-sm">
            {watchlist.map((w) => (
              <a key={w.id} href={w.listing.url} target="_blank" rel="noreferrer" className="block rounded-2xl border p-3 hover:bg-muted/40">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-medium">{w.listing.title || "Ohne Titel"}</span>
                  <span className="text-xs text-muted-foreground">Score {Math.round(w.listing.deal_score || 0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{w.listing.district || "München"}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
