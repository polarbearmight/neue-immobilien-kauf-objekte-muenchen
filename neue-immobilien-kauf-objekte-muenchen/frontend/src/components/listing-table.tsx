"use client";

import { useMemo, useRef } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Listing } from "@/lib/api";

const eur = (v?: number | null) => (v == null ? "-" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v));

const columnHelper = createColumnHelper<Listing>();

export function ListingTable({ rows, onDetails }: { rows: Listing[]; onDetails: (l: Listing) => void }) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("title", { header: "Title", cell: (info) => info.getValue() || "Ohne Titel" }),
      columnHelper.accessor("district", { header: "District", cell: (info) => info.getValue() || "-" }),
      columnHelper.accessor("rooms", { header: "Rooms", cell: (info) => info.getValue() ?? "-" }),
      columnHelper.accessor("area_sqm", { header: "Size", cell: (info) => (info.getValue() ? `${info.getValue()} m²` : "-") }),
      columnHelper.accessor("price_eur", { header: "Price", cell: (info) => eur(info.getValue()) }),
      columnHelper.accessor("price_per_sqm", { header: "€/m²", cell: (info) => eur(info.getValue()) }),
      columnHelper.accessor("deal_score", { header: "Score", cell: (info) => Math.round(info.getValue() || 0) }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <button className="rounded border px-2 py-1 text-xs" onClick={() => onDetails(info.row.original)}>
            Details
          </button>
        ),
      }),
    ],
    [onDetails]
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 46,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div>
      <div className="grid grid-cols-8 gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
        {table.getHeaderGroups()[0].headers.map((header) => (
          <div key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</div>
        ))}
      </div>
      <div ref={parentRef} className="max-h-[65vh] overflow-auto">
        <div style={{ height: `${totalSize}px`, position: "relative" }}>
          {virtualRows.map((vr) => {
            const row = table.getRowModel().rows[vr.index];
            return (
              <div
                key={row.id}
                className="grid grid-cols-8 gap-2 border-b py-2 text-sm"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vr.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
