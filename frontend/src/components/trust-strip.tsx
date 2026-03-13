export function TrustStrip() {
  const items = [
    'Alle großen Portale + zusätzliche Quellen',
    'Automatische Deal-Bewertung',
    'Preisverlauf, Investment und Off-Market Signale',
    'Mobile + Desktop optimiert',
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item} className="rounded-[1.6rem] border border-white/70 bg-white/85 px-5 py-4 text-sm text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          {item}
        </div>
      ))}
    </div>
  );
}
