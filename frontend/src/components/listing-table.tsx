"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExternalLink, Star } from "lucide-react";
import { API_URL, Listing, authHeaders } from "@/lib/api";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";
import { cn } from "@/lib/utils";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));
const eurPerSqm = (v?: number | null) => (v == null ? "-" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €/m²`);
const columnHelper = createColumnHelper<Listing>();

function ListingTableInner({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  const [sortKey, setSortKey] = useState<"area_sqm" | "price_eur" | "price_per_sqm" | "deal_score" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  const toggleSort = useCallback((key: "area_sqm" | "price_eur" | "price_per_sqm" | "deal_score") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "area_sqm" ? "asc" : "desc");
  }, [sortKey]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const getValue = (x: Listing): number => {
      if (sortKey === "area_sqm") return Number(x.area_sqm ?? -Infinity);
      if (sortKey === "price_eur") return Number(x.price_eur ?? -Infinity);
      if (sortKey === "price_per_sqm") return Number(x.price_per_sqm ?? -Infinity);
      return Number(x.deal_score ?? -Infinity);
    };
    const arr = [...rows];
    arr.sort((a, b) => {
      const cmp = getValue(a) - getValue(b);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const sortIndicator = useCallback((key: "area_sqm" | "price_eur" | "price_per_sqm" | "deal_score") => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }, [sortDir, sortKey]);

  const saveToWatchlist = async (listingId?: number) => {
    if (!listingId) return;
    setSavedIds((prev) => ({ ...prev, [listingId]: true }));
    setSavingIds((prev) => ({ ...prev, [listingId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${listingId}`, { method: "POST" });
      if (!res.ok) throw new Error("watchlist_save_failed");
    } catch {
      setSavedIds((prev) => ({ ...prev, [listingId]: false }));
    } finally {
      setSavingIds((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const gridTemplate = "220px minmax(260px,1.5fr) 220px 70px 90px 130px 120px 80px 240px";
  const columns = useMemo(() => [
    columnHelper.display({
      id: "badges",
      header: "Badges",
      cell: (info) => {
        const all = listingHighlightBadges(info.row.original);
        if (!all.length) return "-";
        const shown = all.slice(0, 2);
        const rest = all.length - shown.length;
        return <div className="flex h-6 items-center gap-1 overflow-hidden whitespace-nowrap">{shown.map((x) => <span key={x.key} className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeToneClass(x.tone)}`}>{x.label}</span>)}{rest > 0 ? <span className="text-[10px] text-muted-foreground">+{rest}</span> : null}</div>;
      },
    }),
    columnHelper.accessor("title", { header: "Titel", cell: (info) => info.getValue() || "Ohne Titel" }),
    columnHelper.accessor("district", { header: "Stadtteil", cell: (info) => <span className="inline-block min-w-[170px] whitespace-nowrap">📍 {info.getValue() || "München"}</span> }),
    columnHelper.accessor("rooms", { header: "Zi.", cell: (info) => info.getValue() ?? "-" }),
    columnHelper.accessor("area_sqm", { header: () => <button className="text-left" onClick={() => toggleSort("area_sqm")}>Größe {sortIndicator("area_sqm")}</button>, cell: (info) => (info.getValue() ? `${info.getValue()} m²` : "-") }),
    columnHelper.accessor("price_eur", { header: () => <button className="text-left" onClick={() => toggleSort("price_eur")}>Preis {sortIndicator("price_eur")}</button>, cell: (info) => eur(info.getValue()) }),
    columnHelper.accessor("price_per_sqm", { header: () => <button className="text-left" onClick={() => toggleSort("price_per_sqm")}>€/m² {sortIndicator("price_per_sqm")}</button>, cell: (info) => eurPerSqm(info.getValue()) }),
    columnHelper.accessor("deal_score", { header: () => <button className="text-left" onClick={() => toggleSort("deal_score")}>Score {sortIndicator("deal_score")}</button>, cell: (info) => Math.round(info.getValue() || 0) }),
    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: (info) => {
        const listingId = info.row.original.id;
        const isSaved = !!(listingId && savedIds[listingId]);
        const isSaving = !!(listingId && savingIds[listingId]);
        return (
          <div className="flex items-center gap-2">
            <a className="inline-flex rounded-xl border border-border px-2.5 py-1.5 text-xs hover:bg-accent" href={info.row.original.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Öffnen</a>
            <button className="rounded-xl border border-border px-2.5 py-1.5 text-xs hover:bg-accent" onClick={() => onDetails(info.row.original)}>Details</button>
            <button className={cn("inline-flex items-center rounded-xl border px-2.5 py-1.5 text-xs", isSaved ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" : "border-border hover:bg-accent")} onClick={() => saveToWatchlist(listingId)} disabled={!listingId || isSaving}><Star className={cn("mr-1 h-3.5 w-3.5", isSaved && "fill-current")} />{isSaving ? "Speichert…" : isSaved ? "Gespeichert" : "Merken"}</button>
          </div>
        );
      },
    }),
  ], [onDetails, savedIds, savingIds, sortIndicator, toggleSort]);

  const table = useReactTable({ data: sortedRows, columns, getCoreRowModel: getCoreRowModel() });
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({ count: table.getRowModel().rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 56, overscan: 10 });
  const virtualRows = rowVirtualizer.getVirtualItems();

  if (rows.length === 0) {
    return <div className="rounded-3xl border border-border bg-muted/40 p-8 text-sm text-muted-foreground">Keine Listings für die aktuellen Filter gefunden. Passe Score, Preis oder Stadtteile an.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="px-1 text-xs text-muted-foreground md:hidden">Tipp: In der Tabelle horizontal wischen, um alle Spalten zu sehen.</div>
      <div className="overflow-x-auto rounded-[1.75rem] border border-border bg-card/80 [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain">
        <div className="min-w-[1330px] pr-6">
          <div ref={parentRef} className="max-h-[65vh] overflow-y-auto overflow-x-visible">
            <div className="sticky top-0 z-10 grid gap-2 border-b border-border bg-background/95 pb-3 pt-3 text-xs font-semibold text-muted-foreground backdrop-blur" style={{ gridTemplateColumns: gridTemplate }}>
              {table.getHeaderGroups()[0].headers.map((header) => <div key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</div>)}
            </div>
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative", minWidth: gridTemplate }}>
              {virtualRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                const rowClass = listingHighlightRowClass(row.original);
                return (
                  <div key={row.id} className={cn("grid gap-2 border-b border-border/70 py-3 text-sm", rowClass)} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vr.start}px)`, gridTemplateColumns: gridTemplate }}>
                    {row.getVisibleCells().map((cell) => <div key={cell.id} className={cell.column.id === "district" ? "overflow-visible" : "truncate"}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ListingTable = memo(ListingTableInner);
