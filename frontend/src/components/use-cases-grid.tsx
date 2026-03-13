const cases = [
  {
    title: 'Für Investoren',
    text: 'Deals schneller identifizieren, Preisverläufe prüfen und Objekte mit attraktiver Rendite systematisch priorisieren.',
  },
  {
    title: 'Für Makler',
    text: 'Marktbewegungen und vergleichbare Listings zentral sehen, statt Portale einzeln nach neuen Chancen zu durchsuchen.',
  },
  {
    title: 'Für Suchende',
    text: 'Neue Kaufobjekte früher sehen und mit mehr Kontext bewerten als in klassischen Portalsuchen.',
  },
];

export function UseCasesGrid() {
  return (
    <div className="grid gap-6 lg:grid-cols-3 xl:gap-8">
      {cases.map((item) => (
        <div key={item.title} className="desktop-luxury-hover rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
          <p className="mt-3 leading-relaxed text-slate-600">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
