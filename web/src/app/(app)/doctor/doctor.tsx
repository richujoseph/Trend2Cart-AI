"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, Eye, IndianRupee, MousePointerClick, PackageCheck, PlayCircle,
  ShoppingBag, Stethoscope, Trophy, Undo2,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  type Benchmarks, type Checkup, VERDICT_TONE, healthScore, previewRates, verdictKey, weakest,
} from "@/lib/doctor";
import { fmt, useT } from "@/lib/i18n";
import { type ProductListItem, formatRupees, formatRupeesWhole } from "@/lib/products";
import { type Reel, languageLabel } from "@/lib/reels";
import { ErrorState, ProductImage } from "@/components/states";
import { DataRow, RibbonBackground, ScoreRing, SectionTitle, btn, dataCard, glassCard, glassInput } from "@/components/ui";
import CheckupView, { FunnelView } from "./checkup";

const FIELDS = [
  { key: "views", icon: Eye },
  { key: "clicks", icon: MousePointerClick },
  { key: "orders", icon: ShoppingBag },
  { key: "returns", icon: Undo2 },
] as const;
type Numbers = Record<(typeof FIELDS)[number]["key"], string>;

/** The earlier check-up for the same product, to show progress. */
function previousFor(c: Checkup, all: Checkup[]): Checkup | undefined {
  return all.find((x) => x.id !== c.id && x.product_id === c.product_id && x.entered_at < c.entered_at);
}

const signedWhole = (paise: number) => `${paise < 0 ? "−" : ""}${formatRupeesWhole(Math.abs(paise))}`;

export default function Doctor() {
  const { t, date } = useT();
  const reelParam = useSearchParams().get("reel");
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [history, setHistory] = useState<Checkup[] | null>(null);
  const [bench, setBench] = useState<Benchmarks | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(reelParam ? 2 : 1);
  const [source, setSource] = useState(reelParam ?? "");
  const [productId, setProductId] = useState("");
  const [numbers, setNumbers] = useState<Numbers>({ views: "", clicks: "", orders: "", returns: "" });
  const [price, setPrice] = useState("");
  const [adSpend, setAdSpend] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Checkup | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Reel[]>("/reels"),
      apiFetch<ProductListItem[]>("/products?sort=profit"),
      apiFetch<Checkup[]>("/doctor"),
      apiFetch<Benchmarks>("/doctor/benchmarks"),
    ])
      .then(([r, p, h, b]) => {
        setReels(r.filter((x) => x.status === "done"));
        setProducts(p);
        setHistory(h);
        setBench(b);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setWorking((s) => Math.min(s + 1, 2)), 2500);
    return () => clearInterval(timer);
  }, [busy]);

  const chosenProductId = source === "other" ? productId : reels?.find((r) => r.id === source)?.product_id;
  const product = products?.find((p) => p.id === chosenProductId);
  const n = Object.fromEntries(FIELDS.map((f) => [f.key, Number(numbers[f.key] || 0)])) as Record<keyof Numbers, number>;
  const warning = n.clicks > n.views ? t.doctor.warnClicks : n.returns > n.orders ? t.doctor.warnReturns : null;
  const preview = bench ? previewRates(n, bench, product?.category) : {};
  const previewHealth = healthScore(preview);

  function next() {
    setError(null);
    if (step === 1) {
      if (!source) return setError(t.doctor.errReel);
      if (source === "other" && !productId) return setError(t.doctor.errProduct);
    }
    if (step === 2) {
      if (n.views <= 0) return setError(t.doctor.errViews);
      if (warning) return setError(warning);
    }
    setStep((s) => s + 1);
  }

  async function run() {
    setBusy(true);
    setWorking(0);
    setError(null);
    try {
      const body = {
        ...(source === "other" ? { product_id: productId } : { reel_id: source }),
        ...n,
        ...(price && { selling_price_paise: Math.round(Number(price) * 100) }),
        ad_spend_paise: Math.round(Number(adSpend || 0) * 100),
      };
      // Writing advice can take up to ~50 s on the free AI tier.
      const c = await apiFetch<Checkup>("/doctor", { method: "POST", body: JSON.stringify(body), timeoutMs: 75_000 });
      setResult(c);
      setHistory((h) => [c, ...(h ?? [])]);
      setStep(1);
      setNumbers({ views: "", clicks: "", orders: "", returns: "" });
      setTimeout(() => document.getElementById("diagnosis")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  const past = (history ?? []).filter((h) => h.id !== result?.id);

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0">
      <section className="relative isolate -mx-5 -mt-4 px-5 pb-2 pt-6 lg:mx-0 lg:mt-0 lg:px-0">
        <RibbonBackground variant="section" className="-z-10" />
        <span className="glass inline-flex h-10 w-10 items-center justify-center rounded-full">
          <Stethoscope className="h-5 w-5 text-ink" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="mt-4 text-[34px] font-black leading-[1.1] tracking-tight text-ink lg:text-5xl">{t.doctor.title}</h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink-2">{t.doctor.subtitle}</p>
        {history && history.length > 0 ? <HealthSummary history={history} /> : history && <HowItWorks />}
        <a href="#checkup" className={`${btn.light} mt-5`}>
          <PlayCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {history?.length ? t.doctor.start : t.doctor.startFirst}
        </a>
      </section>

      {history && history.length > 0 && <Insights history={history} />}
      </div>
      <div className="min-w-0 lg:sticky lg:top-28">

      <section id="checkup" className={`${glassCard} mt-8 scroll-mt-20 overflow-hidden lg:mt-0`}>
        <div className="flex items-center justify-between gap-2 border-b border-sage/30 p-5">
          <h2 className="text-2xl font-black text-ink">{t.doctor.newCheckup}</h2>
          <span className="text-[13px] tabular-nums text-ink-2">{fmt(t.doctor.stepOf, { n: step })}</span>
        </div>
        <ol className="grid grid-cols-3 gap-2 px-5 pt-4" aria-label={t.newReel.stepsLabel}>
          {t.doctor.steps.map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${i + 1 <= step ? "bg-ember-400" : "bg-sage/20"}`} />
              <span className={`mt-1.5 block text-xs ${i + 1 === step ? "font-medium text-ink" : "text-ink-2"}`}>{label}</span>
            </li>
          ))}
        </ol>

        <div className="p-5">
          {step === 1 && (
            <fieldset className="min-w-0">
              <legend className="mb-3 text-[17px] font-medium text-ink">{t.doctor.whichReel}</legend>
              {!reels && <div className="skeleton-dark h-20 rounded-[24px]" />}
              {reels?.length === 0 && <p className="mb-3 text-[13px] text-ink-2">{t.doctor.noReelsYet}</p>}
              <div className="flex flex-col gap-2">
                {reels?.slice(0, 8).map((r) => (
                  <label
                    key={r.id}
                    className={`glass flex cursor-pointer items-center gap-3 rounded-[20px] p-2.5 transition ${source === r.id ? "ring-2 ring-ember-400" : ""}`}
                  >
                    <input type="radio" name="reel" className="sr-only" checked={source === r.id} onChange={() => setSource(r.id)} />
                    <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[10px] bg-charcoal">
                      {r.video_url && <video src={`${r.video_url}#t=1.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.products?.name ?? t.doctor.reel}</span>
                      <span className="block text-xs text-ink-2">{languageLabel(r.language)} · {date(r.created_at)}</span>
                    </span>
                  </label>
                ))}
                <label className={`glass flex min-h-14 cursor-pointer items-center gap-3 rounded-[20px] p-3 transition ${source === "other" ? "ring-2 ring-ember-400" : ""}`}>
                  <input type="radio" name="reel" className="sr-only" checked={source === "other"} onChange={() => setSource("other")} />
                  <span className="text-[15px] font-medium">{t.doctor.otherReel}</span>
                </label>
              </div>
              {source === "other" && products && (
                <label className="mt-3 flex flex-col gap-2">
                  <span className="text-[15px] font-medium">{t.doctor.productInReel}</span>
                  <select value={productId} onChange={(e) => setProductId(e.target.value)} className={glassInput}>
                    <option value="">{t.doctor.chooseProduct}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
            </fieldset>
          )}

          {step === 2 && (
            <>
              {product && <ChosenProduct p={product} />}
              <fieldset className="min-w-0">
                <legend className="text-[17px] font-medium text-ink">{t.doctor.yourNumbers}</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {FIELDS.map(({ key, icon: Icon }) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-[15px] font-medium">
                        <Icon className="h-4 w-4 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.doctor[key]}
                      </span>
                      <input
                        inputMode="numeric"
                        value={numbers[key]}
                        onChange={(e) => setNumbers((x) => ({ ...x, [key]: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        placeholder="0"
                        className={`${glassInput} text-[17px] font-medium tabular-nums`}
                      />
                      <span className="text-xs leading-snug text-ink-2">{t.doctor[`${key}Hint`]}</span>
                    </label>
                  ))}
                </div>
                {warning && <p className="mt-3 text-[15px] text-loss">{warning}</p>}
                <details className="mt-4 rounded-[16px] bg-card-muted p-4 text-[15px]">
                  <summary className="cursor-pointer font-medium text-ember-300">{t.doctor.whereFind}</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                    <li>{t.doctor.findViews}</li>
                    <li>{t.doctor.findClicks}</li>
                    <li>{t.doctor.findOrders}</li>
                  </ul>
                </details>
              </fieldset>
              {n.views > 0 && !warning && (
                <div className={`${dataCard} mt-5 p-4`} aria-live="polite">
                  <div className="flex items-center gap-3">
                    {previewHealth !== null && <ScoreRing value={previewHealth} size={64} label={t.doctor.healthLabel} onWhite />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-rust-600">{t.doctor.previewTitle}</p>
                      <p className="text-[15px] font-medium leading-snug">{t.checkup[`title${verdictKey(weakest(preview))}`]}</p>
                      <p className="mt-0.5 text-xs text-black/55">{t.doctor.previewHint}</p>
                    </div>
                  </div>
                  <FunnelView counts={n} rates={preview} weak={weakest(preview)} compact onWhite />
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <fieldset className="min-w-0">
              <legend className="flex items-center gap-1.5 text-[17px] font-medium text-ink">
                <IndianRupee className="h-4 w-4 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.doctor.money}{" "}
                <span className="font-normal text-ink-2">{t.common.optional}</span>
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[15px]">{t.doctor.priceSold}</span>
                  <input
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={product ? String(product.selling_price_paise / 100) : t.doctor.marketPrice}
                    className={`${glassInput} text-[17px] font-medium tabular-nums`}
                  />
                  <span className="text-xs leading-snug text-ink-2">
                    {product ? fmt(t.doctor.blankMarket, { price: formatRupees(product.selling_price_paise) }) : t.doctor.blankMarketGeneric}
                  </span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[15px]">{t.doctor.adSpend}</span>
                  <input
                    inputMode="numeric"
                    value={adSpend}
                    onChange={(e) => setAdSpend(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    placeholder="0"
                    className={`${glassInput} text-[17px] font-medium tabular-nums`}
                  />
                  <span className="text-xs leading-snug text-ink-2">{t.doctor.adSpendHint}</span>
                </label>
              </div>
              <p className="mt-4 rounded-[16px] bg-card-muted p-4 text-[15px] tabular-nums text-ink">
                {fmt(t.doctor.summary, { views: n.views.toLocaleString("en-IN"), clicks: n.clicks, orders: n.orders, returns: n.returns })}
              </p>
            </fieldset>
          )}

          {error && <p role="alert" className="mt-4 rounded-[16px] bg-loss/10 p-4 text-[15px] text-loss">{error}</p>}
          <div className="mt-5 flex gap-3">
            {step > 1 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} disabled={busy} className={`${btn.glass} px-5`} aria-label={t.common.back}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            {/* Separate keys: one reused element would turn into the submit action mid-tap. */}
            {step < 3 ? (
              <button key="next" type="button" onClick={next} className={`${btn.light} flex-1`}>
                {t.common.next} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button key="run" type="button" onClick={run} disabled={busy} className={`${btn.light} flex-1`} aria-live="polite">
                <Stethoscope className="h-4 w-4" aria-hidden /> {busy ? t.doctor.working[working] : t.doctor.submit}
              </button>
            )}
          </div>
        </div>
      </section>
      </div>
      </div>

      {result && (
        <section id="diagnosis" className="mt-6 scroll-mt-20 animate-rise" aria-live="polite">
          <h2 className="mb-3 text-2xl font-black text-ink">{fmt(t.doctor.results, { name: result.products?.name ?? t.reel.yourReel })}</h2>
          <CheckupView c={result} previous={previousFor(result, history ?? [])} />
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <SectionTitle icon={BarChart3} title={t.doctor.past} />
          <ol className="relative mt-4 flex flex-col gap-3 border-l border-sage/30 pl-4">
            {past.map((h) => {
              const d = h.diagnoses[0];
              const expanded = open === h.id;
              const health = healthScore(d?.rates);
              return (
                <li key={h.id} className="relative">
                  <span aria-hidden className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full ring-4 ring-canvas ${d ? VERDICT_TONE[d.stage].dot : "bg-white/30"}`} />
                  <div className={glassCard}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : h.id)}
                      aria-expanded={expanded}
                      className="flex min-h-14 w-full items-center gap-3 p-4 text-left text-[15px]"
                    >
                      {health !== null && <ScoreRing value={health} size={44} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{h.products?.name ?? t.doctor.reel}</span>
                        <span className="block text-[13px] text-ink-2">
                          {fmt(t.doctor.pastLine, { date: date(h.entered_at), views: h.views.toLocaleString("en-IN"), orders: h.orders })}
                          {d?.money && ` · ${signedWhole(d.money.profit_paise)}`}
                        </span>
                        {d && (
                          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_TONE[d.stage].tone}`}>
                            {t.checkup[`short${verdictKey(d.stage)}`]}
                          </span>
                        )}
                      </span>
                      <ArrowRight aria-hidden strokeWidth={1.5} className={`h-5 w-5 shrink-0 text-ink-2 transition ${expanded ? "rotate-90" : ""}`} />
                    </button>
                    {expanded && (
                      <div className="border-t border-sage/30 p-4">
                        <CheckupView c={h} previous={previousFor(h, history ?? [])} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {history && history.length === 0 && reels?.length === 0 && (
        <p className="mt-6 text-center text-sm text-ink-2">
          {t.doctor.noReels} <Link href="/reels/new" className="font-medium text-ember-300">{t.doctor.makeFirst}</Link>
        </p>
      )}
    </>
  );
}

function ChosenProduct({ p }: { p: ProductListItem }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-card-muted p-2.5 text-[15px]">
      <span className="flex h-10 w-10 shrink-0 rounded-[10px] bg-card-muted p-1">
        <ProductImage src={p.image_urls[0]} name={p.name} className="h-full w-full rounded-[7px]" />
      </span>
      <span className="truncate font-medium">{p.name}</span>
    </div>
  );
}

function HowItWorks() {
  const { t } = useT();
  return (
    <ol className="mt-5 grid grid-cols-3 gap-2 text-center text-[13px]">
      {t.doctor.how.map((s, i) => (
        <li key={s} className="glass rounded-[16px] p-3 leading-snug text-ink">
          <span className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-medium text-charcoal">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** Latest check-up per product → overall health, plus money and returns totals. */
function HealthSummary({ history }: { history: Checkup[] }) {
  const { t } = useT();
  const latest = new Map<string, Checkup>();
  for (const h of history) if (!latest.has(h.product_id ?? h.id)) latest.set(h.product_id ?? h.id, h);
  const scores = [...latest.values()].map((h) => healthScore(h.diagnoses[0]?.rates)).filter((s): s is number => s !== null);
  const health = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const orders = history.reduce((a, h) => a + h.orders, 0);
  const returns = history.reduce((a, h) => a + h.returns, 0);
  const withMoney = history.filter((h) => h.diagnoses[0]?.money);
  const profit = withMoney.reduce((a, h) => a + h.diagnoses[0].money!.profit_paise, 0);
  return (
    <div className={`${dataCard} mt-5 p-5`}>
      <div className="flex items-center gap-4">
        {health !== null && <ScoreRing value={health} size={76} label={t.doctor.healthLabel} onWhite />}
        <div className="min-w-0">
          <p className="text-[13px] text-black/55">{t.doctor.statProfit}</p>
          <p className={`text-[32px] font-medium leading-none tabular-nums ${profit >= 0 ? "text-profit-strong" : "text-loss-strong"}`}>
            {withMoney.length ? signedWhole(profit) : "–"}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <DataRow label={t.doctor.statOrders} value={String(orders)} />
        <DataRow label={t.doctor.statReturnRate} value={orders ? `${Math.round((returns / orders) * 100)}%` : "–"} />
        <DataRow label={t.doctor.statCheckups} value={String(history.length)} />
      </div>
    </div>
  );
}

/** Profit per check-up over time and the products that earn most. */
function Insights({ history }: { history: Checkup[] }) {
  const { t, date } = useT();
  const recent = useMemo(() => history.filter((h) => h.diagnoses[0]?.money).slice(0, 8).reverse(), [history]);
  const max = Math.max(1, ...recent.map((h) => Math.abs(h.diagnoses[0].money!.profit_paise)));
  const byProduct = new Map<string, { name: string; profit: number; orders: number; checks: number }>();
  for (const h of history) {
    const key = h.product_id ?? h.id;
    const row = byProduct.get(key) ?? { name: h.products?.name ?? t.doctor.reel, profit: 0, orders: 0, checks: 0 };
    row.profit += h.diagnoses[0]?.money?.profit_paise ?? 0;
    row.orders += h.orders;
    row.checks += 1;
    byProduct.set(key, row);
  }
  const leaders = [...byProduct.values()].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const top = Math.max(1, ...leaders.map((l) => Math.abs(l.profit)));

  return (
    <section className="mt-6 grid gap-4">
      {recent.length > 1 && (
        <div className={`${dataCard} p-5`}>
          <p className="flex items-center gap-2 text-xl font-black"><BarChart3 className="h-[18px] w-[18px] text-rust-600" strokeWidth={1.5} aria-hidden /> {t.doctor.profitChart}</p>
          <div className="mt-3 flex h-32 items-end gap-2" role="img" aria-label={t.doctor.profitChart}>
            {recent.map((h) => {
              const p = h.diagnoses[0].money!.profit_paise;
              return (
                <div key={h.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className={`text-[11px] font-medium tabular-nums ${p >= 0 ? "text-profit-strong" : "text-loss-strong"}`}>{signedWhole(p)}</span>
                  <span
                    className={`w-full max-w-10 rounded-t-[8px] ${p >= 0 ? "bg-profit-strong" : "bg-loss-strong"}`}
                    style={{ height: `${Math.max(6, (Math.abs(p) / max) * 80)}%` }}
                  />
                  <span className="text-[11px] text-black/55">{date(h.entered_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {leaders.length > 0 && (
        <div className={`${dataCard} p-5`}>
          <p className="flex items-center gap-2 text-xl font-black"><Trophy className="h-[18px] w-[18px] text-rust-600" strokeWidth={1.5} aria-hidden /> {t.doctor.leaderboard}</p>
          <ol className="mt-3 flex flex-col">
            {leaders.map((l, i) => (
              <li key={l.name + i} className="border-t border-black/[0.08] py-3">
                <div className="flex items-center justify-between gap-2 text-[15px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${i === 0 ? "bg-charcoal text-white" : "bg-card-muted text-black/70"}`}>{i + 1}</span>
                    <span className="truncate font-medium">{l.name}</span>
                  </span>
                  <span className={`shrink-0 font-medium tabular-nums ${l.profit >= 0 ? "text-profit-strong" : "text-loss-strong"}`}>{signedWhole(l.profit)}</span>
                </div>
                <div className="ml-8 mt-1.5 h-1 rounded-full bg-black/[0.06]">
                  <div className={`h-1 rounded-full ${l.profit >= 0 ? "bg-profit-strong" : "bg-loss-strong"}`} style={{ width: `${(Math.abs(l.profit) / top) * 100}%` }} />
                </div>
                <p className="ml-8 mt-1 flex items-center gap-1 text-xs text-black/55">
                  <PackageCheck className="h-3 w-3" aria-hidden /> {fmt(t.doctor.leaderRow, { orders: l.orders, n: l.checks })}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
