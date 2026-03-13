export function DesktopStoryPanel() {
  const items = [
    {
      step: 'Capture',
      title: 'Marktdaten früher bündeln',
      text: 'Portale, kleinere Quellen und frische Bewegungen laufen in einem kuratierten Stream zusammen.',
    },
    {
      step: 'Rank',
      title: 'Relevanz sichtbar machen',
      text: 'Deal Score, Investment Layer und Visibility Signals priorisieren, was wirklich Aufmerksamkeit verdient.',
    },
    {
      step: 'Act',
      title: 'Schneller entscheiden',
      text: 'Produktansicht, Preisverlauf und Detailkontext reduzieren Reibung zwischen Finden und Handeln.',
    },
  ];

  return (
    <div className="hidden xl:grid xl:grid-cols-[0.85fr_1.15fr] xl:gap-8">
      <div className="rounded-[2.2rem] border border-white/80 bg-slate-950 p-8 text-white shadow-[0_40px_140px_rgba(15,23,42,0.2)]">
        <div className="text-xs uppercase tracking-[0.24em] text-white/50">Product Narrative</div>
        <h3 className="mt-4 text-3xl font-semibold tracking-tight">Vom Markt-Noise zur fokussierten Entscheidung</h3>
        <p className="mt-4 text-base leading-relaxed text-white/70">Eine High-End-Oberfläche bringt Quellen, Priorisierung und Deal-Kontext in einen konsistenten Entscheidungsfluss — statt in dutzende einzelne Suchen.</p>
      </div>
      <div className="grid gap-4">
        {items.map((item, index) => (
          <div key={item.step} className="desktop-luxury-hover rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-700">0{index + 1} · {item.step}</div>
            <h4 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h4>
            <p className="mt-3 leading-relaxed text-slate-600">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
