"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatRupees, formatRupeesWhole } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { LanguageSelect, Logo, btn } from "@/components/ui";

type Stats = {
  products: number;
  profitable: number;
  loss_traps: number;
  best_profit_paise: number | null;
  shipping_paise: number;
  cod_min_paise: number;
};

// One container, one section rhythm, typography first. No decorative imagery: every number is live data.
const WRAP = "mx-auto w-full max-w-6xl px-5 md:px-10";

function SectionHead({ id, eyebrow, title, body }: { id?: string; eyebrow: string; title: string; body?: string }) {
  return (
    <header id={id} className="scroll-mt-24 border-t border-sage/40 pt-8 md:grid md:grid-cols-12 md:gap-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-3 md:col-span-3 md:pt-3">{eyebrow}</p>
      <div className="mt-3 md:col-span-9 md:mt-0">
        <h2 className="max-w-3xl text-[clamp(1.85rem,8vw,3.25rem)] font-semibold leading-[1.08] text-charcoal [overflow-wrap:anywhere]">{title}</h2>
        {body && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{body}</p>}
      </div>
    </header>
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
  const figures: [string, string][] = [
    [L.numChecked, stats ? String(stats.products) : "–"],
    [L.numProfitable, stats ? String(stats.profitable) : "–"],
    [L.numTraps, stats ? String(stats.loss_traps) : "–"],
    [L.numBest, stats?.best_profit_paise ? formatRupeesWhole(stats.best_profit_paise) : "–"],
  ];

  return (
    <div className="min-h-dvh bg-canvas text-charcoal">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-sage/30 bg-canvas/85 backdrop-blur-md">
        <nav className={`${WRAP} flex h-16 items-center justify-between`}>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">Trend2Cart</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-semibold text-ink-2 md:flex">
            <a href="#features" className="transition hover:text-charcoal">{L.navFeatures}</a>
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
      <section className={`${WRAP} pb-20 pt-20 md:pb-28 md:pt-32`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-3">{L.eyebrow}</p>
        <h1 className="mt-6 max-w-4xl text-[clamp(2.25rem,10.5vw,5.5rem)] font-semibold leading-[1.04] text-charcoal [overflow-wrap:anywhere]">{L.title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-2 md:text-xl">{L.sub}</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href={start} className={`${btn.light} px-7`}>
            {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </Link>
          <a href="#how" className={`${btn.glass} px-7`}>{L.ctaHow}</a>
          <span className="ml-1 text-sm font-semibold text-ink-3">{L.langs}</span>
        </div>

        {/* Live catalog figures */}
        <dl className="mt-20 grid grid-cols-2 gap-px overflow-hidden border-y border-sage/40 bg-sage/40 md:grid-cols-4">
          {figures.map(([label, value]) => (
            <div key={label} className="bg-canvas py-7 pr-4 md:pl-8 md:first:pl-0 [&:nth-child(even)]:pl-5 md:[&:nth-child(even)]:pl-8">
              <dt className="text-xs font-semibold text-ink-3">{label}</dt>
              <dd className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="pt-4 text-xs text-ink-3">{L.numbersTitle}</p>
      </section>

      {/* Features */}
      <section className={`${WRAP} py-16 md:py-24`}>
        <SectionHead id="features" eyebrow={L.navFeatures} title={L.solutionTitle} body={L.solutionBody} />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-[32px] bg-sage/40 ring-1 ring-sage/40 md:grid-cols-2 lg:grid-cols-3">
          {L.why.map(([title, body], i) => (
            <li key={title} className={`bg-white p-8 ${i === 4 ? "lg:col-span-1 md:col-span-2" : ""}`}>
              <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-ink-3">0{i + 1}</span>
              <h3 className="mt-6 text-xl font-bold text-charcoal">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
          <li className="hidden bg-charcoal p-8 text-white lg:flex lg:flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-sage">{L.builtLabel}</span>
            <ul className="mt-6 space-y-3 text-[15px] font-semibold">
              {L.built.map((b) => <li key={b} className="border-b border-white/10 pb-3 last:border-0">{b}</li>)}
            </ul>
          </li>
        </ol>
      </section>

      {/* How it works */}
      <section className={`${WRAP} py-16 md:py-24`}>
        <SectionHead id="how" eyebrow={L.navHow} title={L.howTitle} />
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {L.how.map(([title, body], i) => (
            <li key={title} className="border-t-2 border-charcoal pt-6">
              <span className="font-[family-name:var(--font-display)] text-6xl font-semibold tabular-nums leading-none text-charcoal">{i + 1}</span>
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Transparent maths */}
      <section className={`${WRAP} py-16 md:py-24`}>
        <SectionHead id="why" eyebrow={L.navWhy} title={L.statement} />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
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
            <div key={table.title} className="rounded-[32px] bg-white p-8 ring-1 ring-sage/40">
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
      <section className={`${WRAP} py-16 md:py-24`}>
        <SectionHead id="pricing" eyebrow={L.navPricing} title={L.pricingTitle} />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
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
        <div className="rounded-[40px] bg-charcoal px-8 py-16 text-white md:px-16 md:py-24">
          <h2 className="max-w-3xl text-[clamp(1.85rem,8vw,3.75rem)] font-semibold leading-[1.05] [overflow-wrap:anywhere]">{L.finalTitle}</h2>
          <p className="mt-5 text-lg text-white/70">{L.finalBody}</p>
          <Link href={start} className={`${btn.light} mt-10 px-8`}>
            {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </Link>
        </div>
        <footer className="mt-10 flex flex-col gap-3 border-t border-sage/40 pt-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Logo size={22} /> {L.footer}
          </span>
          <span className="flex gap-6 font-semibold">
            <a href="#features" className="hover:text-charcoal">{L.navFeatures}</a>
            <a href="#pricing" className="hover:text-charcoal">{L.navPricing}</a>
            <Link href={start} className="hover:text-charcoal">{signedIn ? L.openApp : L.signIn}</Link>
          </span>
        </footer>
      </section>
    </div>
  );
}
