"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Building2, Check, Globe, TrendingUp, Zap } from "lucide-react";
import { LoginModal } from "@/components/login-modal";
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

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (!mounted || !rootRef.current) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el, i) => {
          gsap.fromTo(el, { y: 36, opacity: 0 }, {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power2.out",
            delay: i * 0.04,
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
            },
          });
        });

        gsap.fromTo("[data-parallax]", { yPercent: -8, scale: 1.08 }, {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        gsap.fromTo("[data-feature-card]", { opacity: 0, y: 30 }, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.14,
          ease: "power2.out",
          scrollTrigger: {
            trigger: "#features-grid",
            start: "top 75%",
          },
        });
      }, rootRef);

      return () => ctx.revert();
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-700" />
            <span className="text-lg font-bold tracking-tight">DealFinder</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
            <a href="#features" className="transition hover:text-slate-950">Features</a>
            <a href="#vorteile" className="transition hover:text-slate-950">Vorteile</a>
            <a href="#zugang" className="transition hover:text-slate-950">Zugang</a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 md:hidden" onClick={() => setMobileMenu((v) => !v)}>{mobileMenu ? "Close" : "Menu"}</button>
            <button onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Login</button>
          </div>
        </div>
      </header>

      {mobileMenu ? <div className="fixed inset-x-4 top-20 z-40 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur md:hidden animate-in fade-in zoom-in-95 duration-200"><div className="flex flex-col gap-3 text-sm text-slate-600"><a href="#features" onClick={() => setMobileMenu(false)}>Features</a><a href="#vorteile" onClick={() => setMobileMenu(false)}>Vorteile</a><a href="#zugang" onClick={() => setMobileMenu(false)}>Zugang</a></div></div> : null}
      <main className="overflow-x-hidden">
        <section data-hero className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
          <Image data-parallax src={heroBg} alt="Munich skyline" fill priority className="absolute inset-0 object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.55)_0%,rgba(15,23,42,0.72)_100%)]" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-28 text-center sm:px-6 sm:py-32 lg:px-8">
            <h1 data-reveal className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">Finden Sie Immobilien schneller als alle anderen.</h1>
            <p data-reveal className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">Unsere Plattform durchsucht automatisch alle großen Immobilienportale und versteckte Quellen und bündelt die Angebote auf einer einzigen Plattform. So entdecken Sie neue Immobilien früher als die Konkurrenz und sichern sich die besten Deals.</p>
            <div data-reveal className="mt-10">
              <button onClick={() => setOpen(true)} className="rounded-2xl bg-emerald-700 px-8 py-4 text-base font-semibold text-white shadow-[0_20px_60px_rgba(4,120,87,0.35)] transition hover:-translate-y-0.5 hover:bg-emerald-800">Contact Sales for Access</button>
              <p className="mt-4 text-sm text-white/60">Exklusiver Zugang zur Plattform für ausgewählte Nutzer.</p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-white/45">Landing page → Login → Dashboard</p>
            </div>
          </div>
        </section>

        <section id="features" className="bg-white py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 data-reveal className="mx-auto max-w-2xl text-center text-3xl font-bold text-slate-950 sm:text-4xl">Der schnellste Weg zu besseren Immobilien-Deals</h2>
            <div id="features-grid" className="mt-16 grid gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} data-feature-card className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-700"><feature.icon className="h-6 w-6" /></div>
                  <h3 className="mb-3 text-xl font-semibold text-slate-950">{feature.title}</h3>
                  <p className="leading-relaxed text-slate-500">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="vorteile" className="bg-slate-50 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 data-reveal className="text-center text-3xl font-bold text-slate-950 sm:text-4xl">Mehr Deals. Weniger Konkurrenz.</h2>
            <p data-reveal className="mt-6 text-center text-lg leading-relaxed text-slate-500">Anstatt dutzende Immobilienportale manuell zu durchsuchen, erhalten Nutzer alle Angebote gebündelt auf einer Plattform. Das spart Zeit und verschafft einen entscheidenden Informationsvorsprung.</p>
            <ul className="mt-12 space-y-5">
              {benefits.map((benefit) => (
                <li key={benefit} data-reveal className="flex items-center gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700/10"><Check className="h-4 w-4 text-emerald-700" /></span>
                  <span className="font-medium text-slate-900">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="zugang" className="bg-white py-24 lg:py-32">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
            <h2 data-reveal className="text-3xl font-bold text-slate-950 sm:text-4xl">Erhalten Sie Zugang zur Plattform</h2>
            <p data-reveal className="mt-6 text-lg text-slate-500">Unsere Software ist aktuell nur für ausgewählte Nutzer verfügbar.</p>
            <div data-reveal className="mt-10">
              <button onClick={() => setOpen(true)} className="rounded-2xl bg-slate-950 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800">Contact Sales for Access</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} DealFinder. Alle Rechte vorbehalten.</p>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="transition hover:text-slate-950">Kontakt</a>
            <a href="#" className="transition hover:text-slate-950">Impressum</a>
            <a href="#" className="transition hover:text-slate-950">Datenschutz</a>
          </nav>
        </div>
      </footer>

      <LoginModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
