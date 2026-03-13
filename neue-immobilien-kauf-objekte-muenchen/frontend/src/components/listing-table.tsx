"use client";

import { useMemo, useRef, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { API_URL, Listing } from "@/lib/api";
import { badgeToneClass, listingHighlightBadges, listingHighlightRowClass } from "@/lib/deal-highlights";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));
const eurPerSqm = (v?: number | null) => (v == null ? "-" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €/m²`);
const columnHelper = createColumnHelper<Listing>();

export function ListingTable({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  const [sortKey, setSortKey] = useState<"area_sqm" | "price_eur" | "price_per_sqm" | "deal_score" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<number, boolean>>({});

  const toggleSort = (key: "area_sqm" | "price_eur" | "price_per_sqm" | "deal_score") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "area_sqm" ? "asc" : "desc");
  };

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

  const sortIndicator = (key: "area_sqm" | "price_eur" | "price_per_sqm" | "deal_score") => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const saveToWatchlist = async (listingId?: number) => {
    if (!listingId) return;
    setSavingIds((prev) => ({ ...prev, [listingId]: true }));
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${listingId}`, { method: "POST" });
      if (!res.ok) throw new Error("watchlist_save_failed");
      setSavedIds((prev) => ({ ...prev, [listingId]: true }));
    } catch {
      // silent for compact table UI
    } finally {
      setSavingIds((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  const gridTemplate = "220px minmax(260px, 1.5fr) 220px 70px 90px 130px 120px 80px 230px";
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "badges",
        header: "Badges",
        cell: (info) => {
          const all = listingHighlightBadges(info.row.original);
          if (!all.length) return "-";
          const shown = all.slice(0, 2);
          const rest = all.length - shown.length;
          return (
            <div className="flex h-6 items-center gap-1 overflow-hidden whitespace-nowrap">
              {shown.map((x) => <span key={x.key} className={`rounded border px-1.5 py-0.5 text-[10px] ${badgeToneClass(x.tone)}`}>{x.label}</span>)}
              {rest > 0 ? <span className="text-[10px] text-muted-foreground">+{rest}</span> : null}
            </div>
          );
        },
      }),
      columnHelper.accessor("title", { header: "Titel", cell: (info) => info.getValue() || "Ohne Titel" }),
      columnHelper.accessor("district", {
        header: "Stadtteil",
        cell: (info) => {
          const val = info.getValue() ? `📍 ${info.getValue()}` : "📍 München";
          return <span className="inline-block min-w-[170px] whitespace-nowrap">{val}</span>;
        },
      }),
      columnHelper.accessor("rooms", { header: "Zi.", cell: (info) => info.getValue() ?? "-" }),
      columnHelper.accessor("area_sqm", {
        header: () => <button className="text-left" onClick={() => toggleSort("area_sqm")}>Größe {sortIndicator("area_sqm")}</button>,
        cell: (info) => (info.getValue() ? `${info.getValue()} m²` : "-"),
      }),
      columnHelper.accessor("price_eur", {
        header: () => <button className="text-left" onClick={() => toggleSort("price_eur")}>Preis {sortIndicator("price_eur")}</button>,
        cell: (info) => eur(info.getValue()),
      }),
      columnHelper.accessor("price_per_sqm", {
        header: () => <button className="text-left" onClick={() => toggleSort("price_per_sqm")}>€/m² {sortIndicator("price_per_sqm")}</button>,
        cell: (info) => eurPerSqm(info.getValue()),
      }),
      columnHelper.accessor("deal_score", {
        header: () => <button className="text-left" onClick={() => toggleSort("deal_score")}>Score {sortIndicator("deal_score")}</button>,
        cell: (info) => Math.round(info.getValue() || 0),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const listingId = info.row.original.id;
          return (
            <div className="flex items-center gap-2">
              <a
                className="rounded border px-2 py-1 text-xs"
                href={info.row.original.url}
                target="_blank"
                rel="noreferrer"
              >
                Öffnen
              </a>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => onDetails(info.row.original)}>
                Details
              </button>
              <button
                className="rounded border px-2 py-1 text-xs"
                onClick={() => saveToWatchlist(listingId)}
                disabled={!listingId || !!(listingId && savingIds[listingId])}
              >
                {listingId && savingIds[listingId] ? "Speichert…" : listingId && savedIds[listingId] ? "Gespeichert" : "Merken"}
              </button>
            </div>
          );
        },
      }),
    ],
    [onDetails, sortKey, sortDir, savingIds, savedIds]
  );

  const table = useReactTable({ data: sortedRows, columns, getCoreRowModel: getCoreRowModel() });
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({ count: table.getRowModel().rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 48, overscan: 10 });
  const virtualRows = rowVirtualizer.getVirtualItems();

  if (rows.length === 0) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-600">Keine Listings für die aktuellen Filter gefunden. Passe Score, Preis oder Stadtteile an.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <div className="min-w-[1330px]">
        <div ref={parentRef} className="max-h-[65vh] overflow-auto">
          <div className="sticky top-0 z-10 grid gap-2 border-b bg-background pb-2 pt-1 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: gridTemplate }}>
            {table.getHeaderGroups()[0].headers.map((header) => <div key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</div>)}
          </div>
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualRows.map((vr) => {
            const row = table.getRowModel().rows[vr.index];
            const rowClass = listingHighlightRowClass(row.original);
            return (
              <div
                key={row.id}
                className={`grid gap-2 border-b py-2 text-sm ${rowClass}`}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vr.start}px)`, gridTemplateColumns: gridTemplate }}
              >
                {row.getVisibleCells().map((cell) => {
                  const isDistrict = cell.column.id === "district";
                  return (
                    <div key={cell.id} className={isDistrict ? "overflow-visible" : "truncate"}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
