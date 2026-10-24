"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatRupees, formatRupeesWhole } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { LanguageSelect, Logo, btn } from "@/components/ui";

type Stats = {
  products: number;
  profitable: number;
  loss_traps: number;
  best_profit_paise: number | null;
  showcase: { name: string; profit_paise: number }[];
  shipping_paise: number;
  cod_min_paise: number;
};

// Every visual on this page is real: Reels rendered by the app (public/landing) and screenshots of the app itself.
const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-10";
const SOURCES = ["IndiaMART", "Google Shopping", "Google Trends", "Shiprocket"];

/** Loops a real Reel silently; stays still for visitors who prefer reduced motion. */
function ReelVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);
  return <video ref={ref} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />;
}

function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.6rem] bg-charcoal p-[9px] shadow-[0_40px_80px_-30px_rgba(23,30,25,0.55)] ring-1 ring-black/10 ${className}`}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[2.05rem] bg-charcoal">
        {children}
        <span aria-hidden className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-charcoal" />
      </div>
    </div>
  );
}

function BrowserFrame({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <figure className="overflow-hidden rounded-[22px] bg-white shadow-[0_40px_90px_-35px_rgba(23,30,25,0.45)] ring-1 ring-sage/50">
      <div className="flex items-center gap-1.5 border-b border-sage/40 bg-[#f7f5f0] px-4 py-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-sage" />
        <span className="h-2.5 w-2.5 rounded-full bg-sage" />
        <span className="h-2.5 w-2.5 rounded-full bg-sage" />
        <span className="ml-3 h-5 flex-1 rounded-full bg-white ring-1 ring-sage/40" />
      </div>
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 640px, 100vw" className="h-auto w-full" />
    </figure>
  );
}

function FeatureText({ index, eyebrow, title, body, points, dark = false }: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  dark?: boolean;
}) {
  return (
    <div className="max-w-xl">
      <p className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] ${dark ? "text-sage" : "text-ink-3"}`}>
        <span className="font-[family-name:var(--font-display)] text-base normal-case tracking-normal text-red">0{index}</span>
        <span className="h-px w-8 bg-sage" aria-hidden /> {eyebrow}
      </p>
      <h2 className={`mt-5 text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.06] [overflow-wrap:anywhere] ${dark ? "text-white" : "text-charcoal"}`}>{title}</h2>
      <p className={`mt-5 text-lg leading-relaxed ${dark ? "text-white/70" : "text-ink-2"}`}>{body}</p>
      <ul className="mt-8 space-y-3.5">
        {points.map((p) => (
          <li key={p} className={`flex items-start gap-3 text-[15px] font-semibold ${dark ? "text-white" : "text-charcoal"}`}>
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${dark ? "bg-white text-charcoal" : "bg-charcoal text-white"}`}>
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  const { t } = useT();
  const L = t.landing;
  const [stats, setStats] = useState<Stats | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/stats`, { signal: AbortSignal.timeout(15000) })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
    createClient().auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const start = signedIn ? "/products" : "/sign-in";
  // The hero Reel is the hair straightener brush; its card shows that product's live profit.
  const heroProduct = stats?.showcase.find((p) => p.name.toLowerCase().includes("hair straightener"));
  const figures: [string, string][] = [
    [L.numChecked, stats ? String(stats.products) : "–"],
    [L.numProfitable, stats ? String(stats.profitable) : "–"],
    [L.numTraps, stats ? String(stats.loss_traps) : "–"],
    [L.numBest, stats?.best_profit_paise ? formatRupeesWhole(stats.best_profit_paise) : "–"],
  ];

  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas text-charcoal">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-sage/30 bg-canvas/80 backdrop-blur-md">
        <nav className={`${WRAP} flex h-16 items-center justify-between`}>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">Trend2Cart</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold text-ink-2 md:flex">
            <a href="#find" className="transition hover:text-charcoal">{L.navFeatures}</a>
            <a href="#how" className="transition hover:text-charcoal">{L.navHow}</a>
            <a href="#why" className="transition hover:text-charcoal">{L.navWhy}</a>
            <a href="#pricing" className="transition hover:text-charcoal">{L.navPricing}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <Link href={start} className="hidden h-11 items-center rounded-full bg-charcoal px-5 text-sm font-bold text-white transition hover:bg-black/85 sm:inline-flex">
              {signedIn ? L.openApp : L.signIn}
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-sage/35 blur-3xl" />
          <div className="absolute right-[18%] top-[30%] h-72 w-72 rounded-full bg-red/10 blur-3xl" />
          <div className="absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-white/70 blur-3xl" />
        </div>
        <div className={`${WRAP} relative grid items-center gap-14 pb-20 pt-14 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_1fr]`}>
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-bold text-ink-2 ring-1 ring-sage/50 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-red" aria-hidden /> {L.langs}
            </p>
            <h1 className="mt-6 text-[clamp(2.4rem,9.5vw,5.25rem)] font-semibold leading-[1.02] text-charcoal [overflow-wrap:anywhere]">{L.title}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2 md:text-xl">{L.sub}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={start} className={`${btn.light} px-7`}>
                {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              </Link>
              <a href="#find" className={`${btn.glass} px-7`}>{L.ctaHow}</a>
            </div>
            <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-3">{L.sourcesLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-[family-name:var(--font-display)] text-lg font-semibold text-charcoal/70">
              {SOURCES.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>

          {/* Real Reel in a phone, with the real numbers behind it */}
          <div className="relative mx-auto w-full max-w-[17.5rem] sm:max-w-[20rem] lg:mr-8">
            <Phone className="animate-rise">
              <ReelVideo src="/landing/reel-brush.mp4" poster="/landing/brush-1_2.webp" />
            </Phone>
            {heroProduct && (
              <div className="absolute -left-4 top-6 w-48 rounded-[22px] bg-white/90 p-4 shadow-[0_24px_60px_-20px_rgba(23,30,25,0.35)] ring-1 ring-sage/40 backdrop-blur sm:-left-24 sm:w-56">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">{L.heroProfitLabel}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums tracking-tight text-profit">
                  {formatRupeesWhole(heroProduct.profit_paise)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-ink-2">{heroProduct.name}</p>
              </div>
            )}
            <div className="absolute -bottom-6 -right-3 flex w-56 items-center gap-3 rounded-[22px] bg-white/90 p-3.5 shadow-[0_24px_60px_-20px_rgba(23,30,25,0.35)] ring-1 ring-sage/40 backdrop-blur sm:-right-20 sm:w-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-profit/10">
                <CircleCheck className="h-5 w-5 text-profit" strokeWidth={2.2} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-charcoal">{L.heroReelLabel}</span>
                <span className="block text-xs text-ink-2">{L.heroReelSub}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Live catalog figures */}
        <div className={`${WRAP} relative pb-6`}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-sage/40 ring-1 ring-sage/40 md:grid-cols-4">
            {figures.map(([label, value]) => (
              <div key={label} className="bg-white/85 px-6 py-7 backdrop-blur">
                <dt className="text-xs font-semibold text-ink-3">{label}</dt>
                <dd className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 px-1 text-xs text-ink-3">{L.numbersTitle}</p>
        </div>
      </section>

      {/* 01 — Find */}
      <section id="find" className={`${WRAP} grid scroll-mt-24 items-center gap-14 py-20 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16`}>
        <FeatureText index={1} eyebrow={L.f1Eyebrow} title={L.f1Title} body={L.f1Body} points={L.f1Points} />
        <div className="relative pb-10 sm:pb-0">
          <BrowserFrame src="/landing/app-products.webp" alt={L.f1Title} width={2400} height={1500} />
          <div className="absolute -bottom-6 -left-3 w-32 sm:-bottom-12 sm:w-44 lg:-left-12">
            <Phone>
              <Image src="/landing/app-product-mobile.webp" alt="" width={900} height={1846} sizes="176px" className="h-full w-full object-cover object-top" />
            </Phone>
          </div>
        </div>
      </section>

      {/* 02 — Create (dark band) */}
      <section className="bg-charcoal">
        <div className={`${WRAP} grid items-center gap-14 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16`}>
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto flex max-w-lg items-end justify-center">
              <div className="w-[34%] translate-x-6 translate-y-6 -rotate-6 opacity-90">
                <Phone><Image src="/landing/brush-7.webp" alt="" width={540} height={960} sizes="180px" className="h-full w-full object-cover" /></Phone>
              </div>
              <div className="relative z-10 w-[40%]">
                <Phone><ReelVideo src="/landing/reel-rope.mp4" poster="/landing/rope-1_2.webp" /></Phone>
              </div>
              <div className="w-[34%] -translate-x-6 translate-y-6 rotate-6 opacity-90">
                <Phone><Image src="/landing/brush-15.webp" alt="" width={540} height={960} sizes="180px" className="h-full w-full object-cover" /></Phone>
              </div>
            </div>
            <p className="mt-12 text-center text-xs font-semibold text-white/55">{L.realOutput}</p>
          </div>
          <div className="order-1 lg:order-2">
            <FeatureText dark index={2} eyebrow={L.f2Eyebrow} title={L.f2Title} body={L.f2Body} points={L.f2Points} />
          </div>
        </div>
      </section>

      {/* 03 — Grow */}
      <section className={`${WRAP} grid items-center gap-14 py-20 md:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16`}>
        <FeatureText index={3} eyebrow={L.f3Eyebrow} title={L.f3Title} body={L.f3Body} points={L.f3Points} />
        <figure className="overflow-hidden rounded-[32px] bg-white p-3 shadow-[0_40px_90px_-35px_rgba(23,30,25,0.45)] ring-1 ring-sage/50">
          <Image src="/landing/app-report.webp" alt={L.f3Title} width={1626} height={1130} sizes="(min-width: 1024px) 640px, 100vw" className="h-auto w-full rounded-[24px]" />
        </figure>
      </section>

      {/* How it works */}
      <section id="how" className={`${WRAP} scroll-mt-24 py-16 md:py-24`}>
        <div className="flex flex-col gap-5 border-t border-sage/40 pt-8 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-2xl text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.06] [overflow-wrap:anywhere]">{L.howTitle}</h2>
          <Link href={start} className={`${btn.glass} self-start px-6 md:self-auto`}>{L.cta}</Link>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {L.how.map(([title, body], i) => (
            <li key={title} className="rounded-[28px] bg-white p-8 ring-1 ring-sage/40">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-charcoal font-[family-name:var(--font-display)] text-lg font-semibold text-white">{i + 1}</span>
              <h3 className="mt-8 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Transparent maths */}
      <section id="why" className={`${WRAP} scroll-mt-24 py-16 md:py-24`}>
        <div className="border-t border-sage/40 pt-8">
          <h2 className="max-w-3xl text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.06] [overflow-wrap:anywhere]">{L.statement}</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{L.solutionBody}</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            { title: L.costsTitle, rows: [
              [L.costShipping, stats ? formatRupees(stats.shipping_paise) : "–"],
              [L.costCod, stats ? formatRupees(stats.cod_min_paise) : "–"],
              [L.costReturns, L.costReturnsValue],
            ] },
            { title: L.priceTitle, rows: [
              [L.priceSupplier, L.priceSupplierValue],
              [L.priceMarket, L.priceMarketValue],
              [L.priceTrend, L.priceTrendValue],
            ] },
          ].map((table) => (
            <div key={table.title} className="rounded-[28px] bg-white p-8 ring-1 ring-sage/40">
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">{table.title}</h3>
              <dl className="mt-6">
                {table.rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-6 border-t border-sage/40 py-4 text-[15px]">
                    <dt className="text-ink-2">{label}</dt>
                    <dd className="text-right font-bold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={`${WRAP} scroll-mt-24 py-16 md:py-24`}>
        <div className="border-t border-sage/40 pt-8">
          <h2 className="text-[clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.06]">{L.pricingTitle}</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-[32px] bg-white p-8 ring-1 ring-sage/40 md:p-10">
            <p className="text-sm font-bold text-ink-2">{L.free}</p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-6xl font-semibold tabular-nums tracking-tight">₹0</p>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-2">{L.freeBody}</p>
            <Link href={start} className={`${btn.glass} mt-10 self-start px-7`}>{L.cta}</Link>
          </div>
          <div className="flex flex-col rounded-[32px] bg-charcoal p-8 text-white md:p-10">
            <p className="text-sm font-bold text-sage">{L.founding}</p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-6xl font-semibold tabular-nums tracking-tight">₹99</p>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">{L.foundingBody}</p>
            <Link href={start} className={`${btn.light} mt-10 self-start px-7`}>
              {L.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className={`${WRAP} pb-10 pt-16 md:pt-24`}>
        <div className="relative overflow-hidden rounded-[40px] bg-charcoal px-8 py-16 text-white md:px-16 md:py-20">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[1.05] [overflow-wrap:anywhere]">{L.finalTitle}</h2>
            <p className="mt-5 text-lg text-white/70">{L.finalBody}</p>
            <Link href={start} className={`${btn.light} mt-10 px-8`}>
              {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
          <div className="pointer-events-none absolute -bottom-28 right-10 hidden w-56 rotate-6 rounded-[2.6rem] ring-1 ring-white/15 md:block lg:right-24" aria-hidden>
            <Phone><Image src="/landing/app-home-mobile.webp" alt="" width={900} height={1846} sizes="224px" className="h-full w-full object-cover object-top" /></Phone>
          </div>
        </div>
        <footer className="mt-10 flex flex-col gap-3 border-t border-sage/40 pt-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Logo size={22} /> {L.footer}
          </span>
          <span className="flex gap-6 font-semibold">
            <a href="#find" className="hover:text-charcoal">{L.navFeatures}</a>
            <a href="#pricing" className="hover:text-charcoal">{L.navPricing}</a>
            <Link href={start} className="hover:text-charcoal">{signedIn ? L.openApp : L.signIn}</Link>
          </span>
        </footer>
      </section>
    </div>
  );
}
