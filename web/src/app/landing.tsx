"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeIndianRupee, Clapperboard, Database, Languages, RotateCcw, Stethoscope,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { LanguageSelect, Logo, Ribbons, SpecRow, btnPrimary, btnSecondary, card, cardLight } from "@/components/ui";

type Stats = {
  products: number;
  profitable: number;
  loss_traps: number;
  best_profit_paise: number | null;
  showcase: { name: string; category: string; image: string; profit_paise: number }[];
  shipping_paise: number;
  cod_min_paise: number;
};

const WHY_ICONS = [Database, BadgeIndianRupee, Languages, Clapperboard, Stethoscope];

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
  const top = stats?.showcase[0];

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-sage/30 bg-canvas/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="text-[15px] font-medium tracking-tight">Trend2Cart</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
            <a href="#features" className="hover:text-ink">{L.navFeatures}</a>
            <a href="#how" className="hover:text-ink">{L.navHow}</a>
            <a href="#why" className="hover:text-ink">{L.navWhy}</a>
            <a href="#pricing" className="hover:text-ink">{L.navPricing}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <Link href={start} className="hidden h-10 items-center rounded-full bg-red px-4 text-sm font-extrabold text-white sm:inline-flex">
              {signedIn ? L.openApp : L.signIn}
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Ribbons className="absolute inset-0 h-full w-full opacity-95 animate-drift" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-canvas" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/55 to-transparent md:via-canvas/30" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-14 md:grid-cols-[1.25fr_1fr] md:px-8 md:pb-24 md:pt-24">
          <div className="animate-rise">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-2">{L.eyebrow}</p>
            <h1 className="mt-4 text-[44px] font-black leading-[1.02] tracking-tight md:text-7xl">{L.title}</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2 md:text-lg">{L.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={start} className={btnPrimary}>
                {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#how" className={btnSecondary}>{L.ctaHow}</a>
            </div>
            <div className="mt-10 inline-flex items-center gap-3 rounded-full bg-card-muted py-1.5 pl-1.5 pr-4 ring-1 ring-sage/40 backdrop-blur">
              <span className="flex -space-x-2">
                {(stats?.showcase ?? []).slice(0, 4).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.name} src={p.image} alt="" className="h-8 w-8 rounded-full bg-white object-cover ring-2 ring-canvas" />
                ))}
              </span>
              <span className="text-xs text-ink-2">{L.langs}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:pt-6">
            <div className={`${card} p-4 animate-rise`} style={{ animationDelay: "120ms" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black">{L.topToday}</p>
                  <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] text-ink-2 ring-1 ring-sage/40">Real Profit Score</span>
                  {top ? (
                    <>
                      <p className="mt-3 line-clamp-2 text-sm text-ink">{top.name}</p>
                      <p className="mt-1 text-2xl font-black tabular-nums text-profit">
                        {formatRupees(top.profit_paise)} <span className="text-xs text-ink-2">{L.perOrder}</span>
                      </p>
                    </>
                  ) : (
                    <div className="mt-3 h-12 w-40 animate-pulse rounded-lg bg-white/5" />
                  )}
                </div>
                {top && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={top.image} alt={top.name} className="h-28 w-28 shrink-0 rounded-xl bg-white object-cover" />
                )}
              </div>
            </div>
            <div className={`${cardLight} p-4 animate-rise`} style={{ animationDelay: "220ms" }}>
              <p className="pb-2 text-lg font-normal">{L.numbersTitle}</p>
              <SpecRow dark label={L.numChecked} value={stats ? stats.products : "–"} />
              <SpecRow dark label={L.numProfitable} value={stats ? stats.profitable : "–"} />
              <SpecRow dark label={L.numTraps} value={stats ? stats.loss_traps : "–"} />
              <SpecRow dark label={L.numBest} value={stats?.best_profit_paise ? formatRupees(stats.best_profit_paise) : "–"} />
            </div>
          </div>
        </div>
      </section>

      {/* Statement with floating chips */}
      <section className="relative mx-auto max-w-6xl px-4 py-20 text-center md:px-8 md:py-28">
        <div className="absolute inset-x-0 top-1/2 -z-0 mx-auto h-64 max-w-3xl -translate-y-1/2 rounded-full bg-sage/30 blur-3xl" aria-hidden />
        <h2 className="relative mx-auto max-w-3xl text-[38px] font-black leading-[1.05] tracking-tight md:text-6xl">{L.statement}</h2>
        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          {[L.chipSupplier, L.chipReels, L.chipCod].map((c, i) => {
            const img = stats?.showcase[i + 1]?.image;
            return (
              <span key={c} className={`${card} flex items-center gap-2 py-1.5 pl-1.5 pr-4 text-xs text-ink-2 animate-rise`} style={{ animationDelay: `${i * 90}ms` }}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-9 w-9 rounded-lg bg-white object-cover" />
                ) : (
                  <span className="h-9 w-9 rounded-lg bg-white/5" />
                )}
                {c}
              </span>
            );
          })}
        </div>
      </section>

      {/* Comprehensive solution */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 md:px-8">
        <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{L.solutionTitle}</h2>
        <div className="mt-8 grid gap-8 border-t border-sage/30 pt-8 md:grid-cols-2">
          <p className="text-lg leading-relaxed text-ink-2">{L.solutionBody}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-6 text-sm">
            <span className="text-ink-3">{L.featuresLabel}</span>
            <ul className="space-y-1.5">{L.features.map((f) => <li key={f}>{f}</li>)}</ul>
            <span className="text-ink-3">{L.builtLabel}</span>
            <ul className="space-y-1.5">{L.built.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className={`${card} relative overflow-hidden p-5`}>
            <div className="relative z-10 max-w-[60%]">
              <p className="text-2xl font-black">{L.reelsTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{L.reelsBody}</p>
              <Link href={start} className={`${btnPrimary} mt-6 min-h-10`}>
                {L.reelsCta} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="absolute -right-6 top-4 bottom-4 flex w-[45%] rotate-[-6deg] gap-2">
              {(stats?.showcase ?? []).slice(0, 2).map((p) => (
                <div key={p.name} className="relative aspect-[9/16] flex-1 overflow-hidden rounded-2xl bg-charcoal ring-1 ring-sage/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" className="absolute inset-x-2 top-[18%] h-[45%] w-[calc(100%-16px)] rounded-lg bg-white object-cover" />
                  <span className="absolute inset-x-2 bottom-[18%] h-1.5 rounded bg-white/80" />
                  <span className="absolute inset-x-4 bottom-[12%] h-1.5 rounded bg-white/50" />
                  <span className="absolute left-1/2 top-[7%] -translate-x-1/2 rounded bg-red px-1.5 text-[9px] font-medium text-white">₹</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className={`${cardLight} p-4`}>
              <p className="pb-2 text-lg">{L.costsTitle}</p>
              <SpecRow dark label={L.costShipping} value={stats ? formatRupees(stats.shipping_paise) : "–"} />
              <SpecRow dark label={L.costCod} value={stats ? formatRupees(stats.cod_min_paise) : "–"} />
              <SpecRow dark label={L.costReturns} value={L.costReturnsValue} />
            </div>
            <div className={`${cardLight} p-4`}>
              <p className="pb-2 text-lg">{L.priceTitle}</p>
              <SpecRow dark label={L.priceSupplier} value={L.priceSupplierValue} />
              <SpecRow dark label={L.priceMarket} value={L.priceMarketValue} />
              <SpecRow dark label={L.priceTrend} value={L.priceTrendValue} />
            </div>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section id="why" className="mx-auto mt-24 max-w-6xl scroll-mt-20 px-4 md:px-8">
        <div className="overflow-hidden rounded-[40px] bg-white ring-1 ring-sage/30">
          <div className="p-6 md:p-10">
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{L.whyTitle}</h2>
          </div>
          <div className="relative border-t border-sage/30 p-4 md:p-8">
            <Ribbons seed={2.4} className="absolute inset-0 h-full w-full opacity-90" />
            <div className="absolute inset-0 bg-transparent" aria-hidden />
            <ul className="relative grid gap-3 md:grid-cols-3">
              {L.why.map(([title, body], i) => {
                const Icon = WHY_ICONS[i];
                return (
                  <li key={title} className={`rounded-2xl bg-transparent p-4 ring-1 ring-sage/40 backdrop-blur-xl ${i === 1 ? "md:translate-y-8" : ""} ${i === 4 ? "md:translate-y-8" : ""}`}>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red/10">
                        <Icon className="h-4 w-4 text-red" strokeWidth={2.2} aria-hidden />
                      </span>
                      {title}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-ink-2">{body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto mt-24 max-w-6xl scroll-mt-20 px-4 md:px-8">
        <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{L.howTitle}</h2>
        <ol className="mt-8 grid gap-4 border-t border-sage/30 pt-8 md:grid-cols-3">
          {L.how.map(([title, body], i) => (
            <li key={title} className={`${card} p-5`}>
              <span className="text-5xl font-black tabular-nums text-brand-500/80">0{i + 1}</span>
              <p className="mt-4 text-lg font-black">{title}</p>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto mt-24 max-w-6xl scroll-mt-20 px-4 md:px-8">
        <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{L.pricingTitle}</h2>
        <div className="mt-8 grid gap-4 border-t border-sage/30 pt-8 md:grid-cols-2">
          <div className={`${card} p-6`}>
            <p className="text-ink-2">{L.free}</p>
            <p className="mt-2 text-5xl font-black">₹0</p>
            <p className="mt-3 text-sm text-ink-2">{L.freeBody}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-6 ring-1 ring-sage/40">
            <Ribbons seed={4.1} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-transparent" aria-hidden />
            <div className="relative">
              <p className="text-ink-2">{L.founding}</p>
              <p className="mt-2 text-5xl font-black">₹99</p>
              <p className="mt-3 text-sm text-ink/85">{L.foundingBody}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative mx-auto mt-24 max-w-6xl px-4 pb-16 md:px-8">
        <div className="relative overflow-hidden rounded-[32px] px-6 py-16 text-center ring-1 ring-sage/40">
          <Ribbons seed={1.2} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-transparent" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-5xl">{L.finalTitle}</h2>
            <p className="mt-3 text-ink-2">{L.finalBody}</p>
            <Link href={start} className={`${btnPrimary} mt-8`}>
              {signedIn ? L.openApp : L.cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <footer className="mt-10 flex items-center justify-between border-t border-sage/30 pt-6 text-xs text-ink-3">
          <span className="flex items-center gap-2"><Logo size={22} /> {L.footer}</span>
          <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" aria-hidden /> COD · RTO · GST</span>
        </footer>
      </section>
    </div>
  );
}
