type MiniBarChartPoint = { label: string; value: number };

type MiniBarChartProps = {
  data: MiniBarChartPoint[];
  onBarClick?: (point: MiniBarChartPoint) => void;
  activeLabel?: string | null;
};

export function MiniBarChart({ data, onBarClick, activeLabel }: MiniBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1">
      {data.map((d) => {
        const isActive = activeLabel === d.label;
        const clickable = Boolean(onBarClick);
        const listingLabel = d.value === 1 ? "1 neues Listing" : `${d.value} neue Listings`;
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onBarClick?.(d)}
            className={`group relative flex flex-1 flex-col items-center ${clickable ? "cursor-pointer" : "cursor-default"}`}
            aria-label={`${d.label}: ${listingLabel}`}
          >
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-[11px] whitespace-nowrap text-foreground shadow-sm group-hover:block">
              <div className="font-medium">{d.label}</div>
              <div className="text-muted-foreground">{listingLabel}</div>
            </div>
            <div
              className={`w-full rounded-t transition-opacity ${isActive ? "bg-primary" : "bg-primary/70 group-hover:bg-primary/90"}`}
              style={{ height: `${Math.max(6, (d.value / max) * 100)}px` }}
            />
            <span className={`mt-1 text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{d.label.slice(5)}</span>
          </button>
        );
      })}
    </div>
  );
}
