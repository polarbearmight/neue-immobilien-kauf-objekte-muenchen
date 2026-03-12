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
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onBarClick?.(d)}
            className={`group flex flex-1 flex-col items-center ${clickable ? "cursor-pointer" : "cursor-default"}`}
            title={`${d.label}: ${d.value}${clickable ? " · klicken zum Filtern" : ""}`}
          >
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
