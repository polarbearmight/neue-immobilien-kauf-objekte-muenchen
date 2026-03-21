import { ContactSalesForm } from "@/components/contact-sales-form";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,183,122,0.14),transparent_20%),linear-gradient(180deg,#050608_0%,#0a0d12_36%,#10141b_100%)]" />
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Contact Sales</p>
            <h1 className="text-4xl font-bold tracking-tight text-white">Private access zur Plattform anfragen</h1>
            <p className="max-w-xl text-lg leading-relaxed text-white/60">Für Nutzer, die Immobilien-Deals auf einer Plattform vereint sehen wollen — inklusive Off-market Chancen und priorisierter Signale.</p>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/72 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <p className="font-semibold text-white">Hilfreich für die Anfrage:</p>
              <ul className="mt-3 space-y-2">
                <li>• Rolle / Kontext</li>
                <li>• Zielmarkt oder Deal-Fokus</li>
                <li>• Investoren-, Makler- oder Suchprofil</li>
              </ul>
            </div>
          </div>
          <ContactSalesForm />
        </div>
      </div>
    </div>
  );
}
