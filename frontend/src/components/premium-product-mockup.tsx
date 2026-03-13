"use client";

export function PremiumProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-6xl xl:max-w-[88rem]">
      <div className="absolute -inset-x-6 -top-8 h-40 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950/70 shadow-[0_30px_120px_rgba(15,23,42,0.45)] backdrop-blur-2xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white/70">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">DealFinder · Live Dashboard</div>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr] xl:grid-cols-[1.28fr_0.72fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r xl:p-7">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Neue Listings</div>
                <div className="mt-2 text-3xl font-semibold">135</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Top Deals</div>
                <div className="mt-2 text-3xl font-semibold">28</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Ø €/m²</div>
                <div className="mt-2 text-3xl font-semibold">9.056</div>
              </div>
            </div>
            <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/50">Top Listing</div>
                  <div className="mt-2 text-xl font-semibold">3-Zimmer Altbau · Maxvorstadt</div>
                  <div className="mt-1 text-sm text-white/60">830.000 € · 78 m² · 10.641 €/m²</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right text-slate-950">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Score</div>
                  <div className="text-2xl font-semibold">91</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {['JUST_LISTED','PRICE_DROP','TOP_DEAL','LOW_VISIBILITY'].map((flag) => (
                  <div key={flag} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">{flag}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-5 text-white xl:p-7">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Decision Panel</div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-sm text-white/60">Investment Score</div>
                  <div className="mt-1 text-2xl font-semibold">78</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-sm text-white/60">Off-Market Score</div>
                  <div className="mt-1 text-2xl font-semibold">64</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-sm text-white/60">Price History</div>
                  <div className="mt-2 flex items-end gap-2">
                    {[30, 42, 36, 51, 48, 60, 64].map((h, i) => <span key={i} className="w-4 rounded-t-full bg-white/70" style={{ height: `${h}px` }} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
