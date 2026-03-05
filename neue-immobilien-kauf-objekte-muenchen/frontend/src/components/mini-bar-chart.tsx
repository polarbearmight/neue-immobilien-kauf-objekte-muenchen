export function MiniBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center">
          <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(6, (d.value / max) * 100)}px` }} title={`${d.label}: ${d.value}`} />
          <span className="mt-1 text-[10px] text-muted-foreground">{d.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
