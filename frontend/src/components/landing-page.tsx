"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Building2, Check, Globe, TrendingUp, Zap } from "lucide-react";
import { LoginModal } from "@/components/login-modal";
import { ContactSalesForm } from "@/components/contact-sales-form";
import { PremiumProductMockup } from "@/components/premium-product-mockup";
import { TrustStrip } from "@/components/trust-strip";
import { UseCasesGrid } from "@/components/use-cases-grid";
import heroBg from "@/app/hero-bg.jpg";

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
  const heroRef = useRef<HTMLElement | null>(null);

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

    const onScroll = () => {
      const y = window.scrollY || 0;
      document.documentElement.style.setProperty("--landing-scroll", String(Math.min(y, 480)));
      if (heroRef.current) {
        heroRef.current.style.setProperty("--hero-shift", `${Math.min(y * 0.12, 36)}px`);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fafc_0%,#eef2ff_35%,#ffffff_68%)] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/55">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70">
              <Building2 className="h-5 w-5 text-emerald-700" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">DealFinder</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
            <a href="#features" className="transition hover:text-slate-950">Features</a>
            <a href="#vorteile" className="transition hover:text-slate-950">Vorteile</a>
            <a href="#zugang" className="transition hover:text-slate-950">Zugang</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
              onClick={() => setMobileMenu((v) => !v)}
            >
              {mobileMenu ? "Close" : "Menu"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-11 rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {mobileMenu ? (
        <div className="fixed inset-x-4 top-20 z-40 rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <a href="#features" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#vorteile" onClick={() => setMobileMenu(false)}>Vorteile</a>
            <a href="#zugang" onClick={() => setMobileMenu(false)}>Zugang</a>
          </div>
        </div>
      ) : null}

      <main className="overflow-x-hidden">
        <section ref={heroRef} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-16 [--hero-shift:0px]">
          <Image src={heroBg} alt="Munich skyline" fill priority className="absolute inset-0 object-cover will-change-transform [transform:scale(1.08)_translateY(var(--hero-shift))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.34)_0%,rgba(15,23,42,0.52)_55%,rgba(15,23,42,0.72)_100%)]" />
          <div className="absolute inset-x-0 top-16 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_70%)]" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 xl:max-w-[88rem] xl:py-32">
            <div data-reveal className="motion-reveal mx-auto mb-5 inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-white/80 backdrop-blur">
              München · Kaufobjekte · Deal Intelligence
            </div>
            <h1 data-reveal className="motion-reveal mx-auto max-w-5xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl xl:max-w-6xl xl:text-7xl">
              Finden Sie Immobilien schneller als alle anderen.
            </h1>
            <p data-reveal className="motion-reveal mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/80 sm:text-xl xl:max-w-4xl xl:text-[1.35rem]">
              Unsere Plattform durchsucht automatisch alle großen Immobilienportale und versteckte Quellen und bündelt die Angebote auf einer einzigen Plattform. So entdecken Sie neue Immobilien früher als die Konkurrenz und sichern sich die besten Deals.
            </p>
            <div data-reveal className="motion-reveal mt-10 flex flex-col items-center gap-4 [transition-delay:80ms]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#contact-sales"
                  className="inline-flex min-h-12 items-center justify-center rounded-[1.35rem] bg-white px-8 py-4 text-base font-semibold text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Zugang anfragen
                </a>
                <a
                  href="#product-preview"
                  className="inline-flex min-h-12 items-center justify-center rounded-[1.35rem] border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Produkt ansehen
                </a>
              </div>
              <p className="text-sm text-white/70">Exklusiver Zugang zur Plattform für ausgewählte Nutzer.</p>
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 backdrop-blur-xl">Private Access · Curated Pipeline · Premium Signals</div>
              <div className="grid w-full max-w-3xl gap-3 pt-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/20 bg-white/10 px-4 py-4 text-left text-white/90 backdrop-blur-xl">
                  <div className="text-2xl font-semibold">24/7</div>
                  <div className="mt-1 text-sm text-white/70">laufende Marktbeobachtung</div>
                </div>
                <div className="rounded-3xl border border-white/20 bg-white/10 px-4 py-4 text-left text-white/90 backdrop-blur-xl">
                  <div className="text-2xl font-semibold">1 View</div>
                  <div className="mt-1 text-sm text-white/70">alle Portale in einer Oberfläche</div>
                </div>
                <div className="rounded-3xl border border-white/20 bg-white/10 px-4 py-4 text-left text-white/90 backdrop-blur-xl">
                  <div className="text-2xl font-semibold">Top Deals</div>
                  <div className="mt-1 text-sm text-white/70">automatisch priorisiert</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product-preview" className="bg-[linear-gradient(180deg,#eef2ff_0%,#ffffff_100%)] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[88rem]">
            <div className="mb-10 grid gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-end">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Produktvorschau</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-5xl">Ein Workspace für Marktüberblick, Deal-Erkennung und schnelle Entscheidungen</h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-600 xl:max-w-2xl">Statt dutzende Quellen manuell zu prüfen, bündelt DealFinder Listings, Preisverläufe, Investment-Signale und Off-Market-Hinweise in einer Oberfläche.</p>
              </div>
              <div className="desktop-luxury-hover rounded-[2rem] border border-white/80 bg-white/70 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Coverage</div><div className="mt-2 text-3xl font-semibold text-slate-950">Multi-Source</div></div>
                  <div><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Decision Layer</div><div className="mt-2 text-3xl font-semibold text-slate-950">Deal + Investment</div></div>
                  <div><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Workflow</div><div className="mt-2 text-3xl font-semibold text-slate-950">Search to Action</div></div>
                </div>
              </div>
            </div>
            <PremiumProductMockup />
          </div>
        </section>

        <section className="bg-white py-14 lg:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <TrustStrip />
          </div>
        </section>

        <section id="features" className="bg-white py-20 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 data-reveal className="motion-reveal mx-auto max-w-2xl text-center text-3xl font-bold text-slate-950 sm:text-4xl">
              Der schnellste Weg zu besseren Immobilien-Deals
            </h2>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="motion-reveal rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-200"
                  data-reveal
                >
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-slate-950">{feature.title}</h3>
                  <p className="leading-relaxed text-slate-500">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-3">
              {storySteps.map((step) => (
                <div key={step.eyebrow} data-reveal className="motion-reveal rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{step.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
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
