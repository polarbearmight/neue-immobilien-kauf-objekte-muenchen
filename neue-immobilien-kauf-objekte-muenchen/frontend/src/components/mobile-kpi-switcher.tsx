"use client";

export function MobileKpiSwitcher({
  active,
  setActive,
}: {
  active: "market" | "deals" | "sources";
  setActive: (value: "market" | "deals" | "sources") => void;
}) {
  const tabs: Array<["market" | "deals" | "sources", string]> = [
    ["market", "Market"],
    ["deals", "Deals"],
    ["sources", "Sources"],
  ];
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/80 p-1.5 shadow-sm backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-3 gap-1">
        {tabs.map(([key, label]) => (
          <button key={key} className={`min-h-10 rounded-2xl px-3 text-sm font-medium ${active === key ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setActive(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
