"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, Lock, Sparkles, TrendingUp } from "lucide-react";
import { LoginModal } from "@/components/login-modal";
import { ContactSalesForm } from "@/components/contact-sales-form";
import { PremiumProductMockup } from "@/components/premium-product-mockup";

const features = [
  {
    icon: Lock,
    title: "Off-market visibility",
    text: "Mehr diskrete Chancen außerhalb des öffentlichen Portal-Standards.",
  },
  {
    icon: Sparkles,
    title: "Alle Deals in einer Sicht",
    text: "Große Portale, kleinere Quellen und diskrete Signale in einer priorisierten Oberfläche.",
  },
  {
    icon: TrendingUp,
    title: "Schneller als der Markt",
    text: "Früher sehen, schneller filtern und vor breiter Konkurrenz reagieren.",
  },
];

const proofPoints = [
  "Off-market Chancen früher sehen",
  "Alle relevanten Deals in einer Oberfläche",
  "Multi-source Intelligence statt Portalsuche",
  "Gebaut für schnelle Kaufentscheidungen",
];

const reviews = [
  {
    quote: "Zum ersten Mal sehe ich Portale, kleinere Quellen und diskrete Chancen in einer Oberfläche statt in zehn offenen Tabs.",
    name: "Tobias R.",
    role: "Privatinvestor · München",
  },
  {
    quote: "Die Stärke ist nicht nur das Design, sondern dass relevante Deals deutlich früher und klarer priorisiert auftauchen.",
    name: "Anna K.",
    role: "Investment Buyer",
  },
  {
    quote: "Für mich fühlt es sich eher wie ein Intelligence-Tool an als wie ein klassisches Immobilienportal. Genau das ist der Vorteil.",
    name: "David M.",
    role: "Family Office Research",
  },
];

const faqs = [
  {
    q: "Was ist der Hauptvorteil gegenüber normalen Immobilienportalen?",
    a: "DealFinder bündelt mehrere Marktquellen und priorisiert relevante Kaufobjekte in einer Oberfläche. Dadurch siehst du Off-market Chancen und alle wichtigen Deals schneller und mit mehr Kontext.",
  },
  {
    q: "Geht es nur um Off-market Immobilien?",
    a: "Nein. Der Kernnutzen ist, öffentliche Portale, kleinere Quellen und diskrete Signale gemeinsam sichtbar zu machen — also nicht nur Off-market, sondern alle relevanten Deals in einer priorisierten Sicht.",
  },
  {
    q: "Für wen ist die Plattform gedacht?",
    a: "Für Käufer, Investoren, Family Offices, Makler oder Suchende mit Anspruch auf Informationsvorsprung, saubere Priorisierung und eine ruhigere Premium-Oberfläche.",
  },
];

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number>(0);

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
    return () => observer.disconnect();
  }, []);

  const activeReview = useMemo(() => reviews[reviewIndex % reviews.length], [reviewIndex]);

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,183,122,0.14),transparent_20%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(180deg,#050608_0%,#0a0d12_36%,#10141b_100%)]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(5,6,8,0.72)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[rgba(5,6,8,0.56)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
              <Building2 className="h-5 w-5 text-[#d2b77a]" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-white">DealFinder</span>
              <span className="text-[10px] uppercase tracking-[0.32em] text-white/35">Private Market Intelligence</span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-white/55 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#reviews" className="transition hover:text-white">Reviews</a>
            <a href="#faq" className="transition hover:text-white">Q&amp;A</a>
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
            <a href="#reviews" onClick={() => setMobileMenu(false)}>Reviews</a>
            <a href="#faq" onClick={() => setMobileMenu(false)}>Q&amp;A</a>
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

          <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 xl:max-w-[88rem] xl:py-32">
            <div className="flex flex-col justify-center">
              <div data-reveal className="motion-reveal mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
                <Lock className="h-3.5 w-3.5 text-[#d2b77a]" />
                Invite Only · München · Curated Access
              </div>
              <h1 data-reveal className="motion-reveal max-w-5xl text-4xl font-semibold leading-tight tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Immobilien-Deals auf einer Plattform vereint — inklusive Off-market Chancen.
              </h1>
              <p data-reveal className="motion-reveal mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
                DealFinder bündelt alle Immobilien Marktquellen, diskrete Signale und priorisierte Kaufobjekte in einer ruhigen Intelligence-Oberfläche.
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
                  href="#zugang"
                  className="inline-flex min-h-12 items-center justify-center rounded-[1.35rem] border border-white/12 bg-white/[0.03] px-8 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/[0.06]"
                >
                  Zugang anfragen
                </a>
              </div>
              <div data-reveal className="motion-reveal mt-8 flex flex-col items-center gap-3 text-sm text-white/52 sm:flex-row sm:flex-wrap sm:justify-start">
                <span className="inline-flex min-w-[220px] justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-center sm:min-w-0">Off-market visibility</span>
                <span className="inline-flex min-w-[220px] justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-center sm:min-w-0">All deals in one layer</span>
                <span className="inline-flex min-w-[220px] justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-center sm:min-w-0">Luxury intelligence UI</span>
              </div>
            </div>

            <div data-reveal className="motion-reveal flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-2xl">
                <div className="mb-4 flex items-center justify-between px-1">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/35">Tool preview</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Alle Deals. Ein Workspace.</h2>
                  </div>
                  <div className="rounded-2xl border border-[#d2b77a]/25 bg-[#d2b77a]/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#e7d2a4]">Live Preview</div>
                </div>
                <PremiumProductMockup />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-white/8 bg-[#0e1218] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Off-market und alle Deals. Schneller priorisiert.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  data-reveal
                  className="motion-reveal rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#d2b77a]/30"
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

        <section id="positioning" className="border-t border-white/8 bg-[#111722] py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Positioning</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">High-end SaaS für Käufer mit Informationsvorsprung.</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/60">
                Die Botschaft ist klar: Mit dieser Software siehst du Off-market Chancen und alle relevanten Deals schneller als der Markt.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <ul className="space-y-4">
                {proofPoints.map((point) => (
                  <li key={point} className="flex items-center gap-4 text-white/72">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d2b77a]/12 text-[#d2b77a]">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-base">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="reviews" className="border-t border-white/8 bg-[#0c1015] py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Top Reviews</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Warum Nutzer die Plattform als Vorsprung empfinden</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
                  onClick={() => setReviewIndex((v) => (v - 1 + reviews.length) % reviews.length)}
                  aria-label="Vorherige Review"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.06]"
                  onClick={() => setReviewIndex((v) => (v + 1) % reviews.length)}
                  aria-label="Nächste Review"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <p className="text-xl leading-relaxed text-white/82 sm:text-2xl">“{activeReview.quote}”</p>
              <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
                <div>
                  <div className="text-base font-semibold text-white">{activeReview.name}</div>
                  <div className="mt-1 text-sm text-white/45">{activeReview.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  {reviews.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReviewIndex(idx)}
                      className={`h-2.5 rounded-full transition ${idx === reviewIndex ? "w-8 bg-[#d2b77a]" : "w-2.5 bg-white/20"}`}
                      aria-label={`Review ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-white/8 bg-[#10141b] py-20 lg:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Q&amp;A</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Häufige Fragen zur Plattform</h2>
            </div>
            <div className="space-y-4">
              {faqs.map((item, idx) => {
                const active = openFaq === idx;
                return (
                  <div key={item.q} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(active ? -1 : idx)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-base font-semibold text-white">{item.q}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-white/50 transition ${active ? "rotate-180" : "rotate-0"}`} />
                    </button>
                    {active ? <div className="px-6 pb-6 text-sm leading-relaxed text-white/60">{item.a}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="zugang" className="border-t border-white/8 bg-[#0d1016] py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:px-8 xl:max-w-[88rem]">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d2b77a]">Concierge Access</p>
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Private access für schnellere Deal-Entscheidungen</h2>
              <p className="text-lg leading-relaxed text-white/60">
                Zugang für Nutzer, die Off-market Opportunities und priorisierte Kaufobjekte früher sehen wollen als andere.
              </p>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                <div className="text-xs uppercase tracking-[0.22em] text-white/35">Access philosophy</div>
                <div className="mt-3 space-y-2 text-sm text-white/68">
                  <p>• weniger Masse</p>
                  <p>• mehr Relevanz</p>
                  <p>• diskreter Premium-Look</p>
                </div>
              </div>
            </div>
            <ContactSalesForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#090b0f] py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <p className="text-sm text-white/38">© {new Date().getFullYear()} DealFinder. Alle Rechte vorbehalten.</p>
          <nav className="flex items-center gap-6 text-sm text-white/45">
            <Link href="/contact" className="transition hover:text-white">Kontakt</Link>
            <Link href="/impressum" className="transition hover:text-white">Impressum</Link>
            <Link href="/privacy" className="transition hover:text-white">Datenschutz</Link>
          </nav>
        </div>
      </footer>

      <LoginModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
