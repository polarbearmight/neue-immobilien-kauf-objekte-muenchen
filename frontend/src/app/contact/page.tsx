import { ContactSalesForm } from "@/components/contact-sales-form";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Contact Sales</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">Zugang zur Plattform anfragen</h1>
          <p className="text-lg leading-relaxed text-slate-600">Schick uns kurz deinen Use Case. Wir melden uns mit dem passenden Zugang, einer Demo oder den nächsten Schritten.</p>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-sm text-emerald-900">
            <p className="font-semibold">Was wir typischerweise brauchen:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Wer du bist</li>
              <li>Wofür du ImmoDealFinder einsetzen willst</li>
              <li>Ob du Investor, Makler oder Suchender bist</li>
            </ul>
          </div>
        </div>
        <ContactSalesForm />
      </div>
    </div>
  );
}
