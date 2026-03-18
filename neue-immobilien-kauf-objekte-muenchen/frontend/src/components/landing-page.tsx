"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Check, Globe, Lock, TrendingUp, Zap } from "lucide-react";
import { LoginModal } from "@/components/login-modal";
import { ContactSalesForm } from "@/components/contact-sales-form";
import { PremiumProductMockup } from "@/components/premium-product-mockup";
import { TrustStrip } from "@/components/trust-strip";
import { UseCasesGrid } from "@/components/use-cases-grid";
import { DesktopStoryPanel } from "@/components/desktop-story-panel";

const features = [
  {
    icon: Globe,
    title: "Alle Immobilienportale auf einer Plattform",
    text: "Die Software durchsucht automatisch alle großen Immobilienportale und zusätzliche versteckte Quellen und zeigt sämtliche Angebote zentral an.",
  },
  {
    icon: Zap,
    title: "Schneller als der Markt",
    text: "Neue Immobilienangebote werden sofort erkannt und erscheinen direkt auf der Plattform. So können Nutzer schneller reagieren als andere Käufer.",
  },
  {
    icon: TrendingUp,
    title: "DealFinder Technologie",
    text: "Der integrierte DealFinder erkennt automatisch besonders attraktive Immobilienangebote und hebt die besten Deals hervor.",
  },
];

const benefits = [
  "Alle Immobilienportale in einer Suche",
  "Frühzeitiger Zugang zu neuen Angeboten",
  "Automatische Deal-Erkennung",
  "Mehr Übersicht über den gesamten Markt",
  "Bessere Investmententscheidungen",
];

const storySteps = [
  {
    eyebrow: "01 · Capture",
    title: "Marktbewegungen früher sehen",
    text: "Neue Inserate, kleine Quellen und frische Marktbewegungen landen schneller in deinem Feed statt erst spät in manuellen Suchen.",
  },
  {
    eyebrow: "02 · Rank",
    title: "Relevanz automatisch priorisieren",
    text: "Deal Score, Investment Signale und Sichtbarkeitsdaten helfen dir, gute Chancen sofort von schlechten Deals zu trennen.",
  },
  {
    eyebrow: "03 · Act",
    title: "Mit mehr Kontext schneller handeln",
    text: "Preisverlauf, Source-Signale und Investment-Metriken geben dir direkt eine belastbare Entscheidungsbasis.",
  },
];

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.setAttribute("data-in-view", "true");
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(180,160,110,0.14),transparent_22%),radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,#06070a_0%,#0b0d12_38%,#11141c_100%)]" />
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgba(7,9,13,0.72)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[rgba(7,9,13,0.58)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
              <Building2 className="h-5 w-5 text-[#d2b77a]" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-white">DealFinder</span>
              <span className="text-[10px] uppercase tracking-[0.32em] text-white/40">Private Market Intelligence</span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-white/55 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#vorteile" className="transition hover:text-white">Vorteile</a>
            <a href="#zugang" className="transition hover:text-white">Zugang</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur md:hidden"
              onClick={() => setMobileMenu((v) => !v)}
            >
              {mobileMenu ? "Close" : "Menu"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-11 rounded-2xl border border-[#d2b77a]/30 bg-[#d2b77a]/10 px-4 py-2 text-sm font-medium text-[#f3e7c4] shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-[#d2b77a]/16"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {mobileMenu ? (
        <div className="fixed inset-x-4 top-20 z-40 rounded-3xl border border-white/10 bg-[rgba(10,12,16,0.92)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <a href="#features" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#vorteile" onClick={() => setMobileMenu(false)}>Vorteile</a>
            <a href="#zugang" onClick={() => setMobileMenu(false)}>Zugang</a>
          </div>
        </div>
      ) : null}

      <main className="overflow-x-hidden">
        <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-16">
          <div className="absolute inset-0">
            <div className="absolute left-[8%] top-28 h-64 w-64 rounded-full bg-[#d2b77a]/[0.08] blur-3xl" />
            <div className="absolute right-[10%] top-44 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 xl:max-w-[88rem] xl:py-32">
            <div className="flex flex-col justify-center">
              <div data-reveal className="motion-reveal mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
                <Lock className="h-3.5 w-3.5 text-[#d2b77a]" />
                Private Access · München · Curated Pipeline
              </div>
              <h1 data-reveal className="motion-reveal max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Immobilien-Deals für Entscheider, die früher sehen wollen, was andere zu spät finden.
              </h1>
              <p data-reveal className="motion-reveal mt-6 max-w-2xl text-lg leading-relaxed text-white/68 sm:text-xl">
                DealFinder bündelt marktrelevante Kaufobjekte, versteckte Quellen und Deal-Signale in einer ruhigen, kuratierten Oberfläche — gebaut für schnelle Entscheidungen mit Premium-Anspruch.
              </p>
              <div data-reveal className="motion-reveal mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.35rem] bg-[#d2b77a] px-8 py-4 text-base font-semibold text-[#17181c] shadow-[0_24px_70px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:bg-[#dcc38d]"
                >
                  Login öffnen
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#contact-sales"
                  className="inline-flex min-h-12 items-center justify-center rounded-[1.35rem] border border-white/12 bg-white/[0.03] px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/[0.06]"
                >
                  Zugang anfragen
                </a>
              </div>
              <div data-reveal className="motion-reveal mt-8 flex flex-wrap gap-3 text-sm text-white/55">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">Private market intelligence</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">High-signal sourcing</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">Concierge-style access</span>
              </div>
            </div>

            <div data-reveal className="motion-reveal flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/40">Access Layer</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Calm interface. High-value signals.</h2>
                  </div>
                  <div className="rounded-2xl border border-[#d2b77a]/25 bg-[#d2b77a]/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#e7d2a4]">Invite only</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/8 bg-[#0f131a] p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40">Coverage</div>
                    <div className="mt-3 text-3xl font-semibold text-white">24/7</div>
                    <div className="mt-2 text-sm leading-relaxed text-white/55">Laufende Beobachtung von Portalen, kleineren Quellen und zusätzlichen Marktsignalen.</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/8 bg-[#0f131a] p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/40">Decision Layer</div>
                    <div className="mt-3 text-3xl font-semibold text-white">Deal + Inv</div>
                    <div className="mt-2 text-sm leading-relaxed text-white/55">Deal Score, Investment-Signale und Off-Market-Hinweise in einem klaren Workflow.</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-[#0f131a] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/40">Why it feels premium</p>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">Weniger Lautstärke, weniger Massenmarkt-Feeling — mehr Fokus auf kuratierte Chancen, diskrete Signale und schnelle Orientierung.</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-[#e7d2a4]">Top Deals</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-white/35">priorisiert</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product-preview" className="border-t border-white/8 bg-[linear-gradient(180deg,#0f1319_0%,#121722_100%)] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[88rem]">
            <div className="mb-10 grid gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-end">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Produktvorschau</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl xl:text-5xl">Ein Workspace für Marktüberblick, Deal-Erkennung und schnelle Entscheidungen</h2>
                <p className="mt-4 text-lg leading-relaxed text-white/62 xl:max-w-2xl">Statt dutzende Quellen manuell zu prüfen, bündelt DealFinder Listings, Preisverläufe, Investment-Signale und Off-Market-Hinweise in einer Oberfläche.</p>
              </div>
              <div className="desktop-luxury-hover rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.26)] backdrop-blur-xl">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Coverage</div><div className="mt-2 text-3xl font-semibold text-white">Multi-Source</div></div>
                  <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Decision Layer</div><div className="mt-2 text-3xl font-semibold text-white">Deal + Investment</div></div>
                  <div><div className="text-xs uppercase tracking-[0.2em] text-white/35">Workflow</div><div className="mt-2 text-3xl font-semibold text-white">Search to Action</div></div>
                </div>
              </div>
            </div>
            <PremiumProductMockup />
          </div>
        </section>

        <section className="bg-[#0f1319] py-14 lg:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <TrustStrip />
          </div>
        </section>

        <section id="features" className="bg-[#11151d] py-20 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 data-reveal className="motion-reveal mx-auto max-w-2xl text-center text-3xl font-bold text-white sm:text-4xl">
              Der schnellste Weg zu besseren Immobilien-Deals
            </h2>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="motion-reveal rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#d2b77a]/30"
                  data-reveal
                >
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#d2b77a]/12 text-[#d2b77a]">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="leading-relaxed text-white/58">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[88rem]">
            <div className="grid gap-6 lg:grid-cols-3 xl:hidden">
              {storySteps.map((step) => (
                <div key={step.eyebrow} data-reveal className="motion-reveal rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{step.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
            <DesktopStoryPanel />
          </div>
        </section>

        <section id="vorteile" className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] py-20 lg:py-32">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold text-slate-950 sm:text-4xl">
              Mehr Deals. Weniger Konkurrenz.
            </h2>
            <p className="mt-6 text-center text-lg leading-relaxed text-slate-500">
              Anstatt dutzende Immobilienportale manuell zu durchsuchen, erhalten Nutzer alle Angebote gebündelt auf einer Plattform. Das spart Zeit und verschafft einen entscheidenden Informationsvorsprung.
            </p>
            <ul className="mt-12 space-y-5">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700/10">
                    <Check className="h-4 w-4 text-emerald-700" />
                  </span>
                  <span className="font-medium text-slate-900">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Use Cases</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Für Teams und Entscheider, die nicht auf Portale warten wollen</h2>
            </div>
            <UseCasesGrid />
          </div>
        </section>

        <section id="zugang" className="bg-white py-20 lg:py-32">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-slate-950 sm:text-4xl">
              Erhalten Sie Zugang zur Plattform
            </h2>
            <p className="mt-6 text-lg text-slate-500">
              Unsere Software ist aktuell nur für ausgewählte Nutzer verfügbar.
            </p>
            <div className="mt-10">
              <a
                href="#contact-sales"
                className="inline-flex min-h-12 items-center justify-center rounded-[1.35rem] bg-slate-950 px-8 py-4 text-base font-semibold text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
              >
                Contact Sales for Access
              </a>
            </div>
          </div>
        </section>

        <section id="contact-sales" className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] py-20 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 xl:max-w-[88rem]">
            <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start xl:gap-14">
              <div className="space-y-6">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Concierge Access</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Zugang anfragen oder Demo vereinbaren</h2>
                <p className="text-lg leading-relaxed text-slate-600">Beschreibe kurz deinen Anwendungsfall. Wir melden uns mit den passenden nächsten Schritten, Demo-Möglichkeiten oder einem qualifizierten Zugang.</p>
                <div className="grid gap-4">
                  <div className="rounded-[1.6rem] border border-white/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <div className="text-sm font-semibold text-slate-950">Was du idealerweise mitschickst</div>
                    <ul className="mt-3 space-y-3 text-sm text-slate-700">
                      <li>• Investor, Makler oder Suchender</li>
                      <li>• gewünschter Einsatzbereich</li>
                      <li>• Zielregion oder Deal-Fokus</li>
                    </ul>
                  </div>
                  <div className="rounded-[1.6rem] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">Response Flow</div>
                    <div className="mt-3 space-y-2 text-sm text-white/85">
                      <p>1. Anfrage prüfen</p>
                      <p>2. Use Case qualifizieren</p>
                      <p>3. Zugang oder Demo abstimmen</p>
                    </div>
                  </div>
                </div>
              </div>
              <ContactSalesForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} DealFinder. Alle Rechte vorbehalten.</p>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/contact" className="transition hover:text-slate-950">Kontakt</Link>
            <Link href="/impressum" className="transition hover:text-slate-950">Impressum</Link>
            <Link href="/privacy" className="transition hover:text-slate-950">Datenschutz</Link>
          </nav>
        </div>
      </footer>

      <LoginModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
