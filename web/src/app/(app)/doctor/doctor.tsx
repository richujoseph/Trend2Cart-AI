"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Checkup, VERDICT_TONE, verdictKey } from "@/lib/doctor";
import { fmt, useT } from "@/lib/i18n";
import { type ProductListItem, formatRupees } from "@/lib/products";
import { type Reel, languageLabel } from "@/lib/reels";
import { ErrorState } from "@/components/states";
import { PageHero, btnPrimary, card, input } from "@/components/ui";
import CheckupView from "./checkup";

// Labels are t.doctor[key] and t.doctor[`${key}Hint`].
const FIELDS = ["views", "clicks", "orders", "returns"] as const;
type Numbers = Record<(typeof FIELDS)[number], string>;

/** The earlier check-up for the same product, to show progress. */
function previousFor(c: Checkup, all: Checkup[]): Checkup | undefined {
  return all.find((x) => x.id !== c.id && x.product_id === c.product_id && x.entered_at < c.entered_at);
}

export default function Doctor() {
  const { t, date } = useT();
  const WORKING = t.doctor.working;
  const reelParam = useSearchParams().get("reel");
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [history, setHistory] = useState<Checkup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [source, setSource] = useState(reelParam ?? "");
  const [productId, setProductId] = useState("");
  const [numbers, setNumbers] = useState<Numbers>({ views: "", clicks: "", orders: "", returns: "" });
  const [price, setPrice] = useState("");
  const [adSpend, setAdSpend] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Checkup | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Reel[]>("/reels"),
      apiFetch<ProductListItem[]>("/products?sort=profit"),
      apiFetch<Checkup[]>("/doctor"),
    ])
      .then(([r, p, h]) => {
        setReels(r.filter((x) => x.status === "done"));
        setProducts(p);
        setHistory(h);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 2500);
    return () => clearInterval(timer);
  }, [busy]);

  const chosenProductId = source === "other" ? productId : reels?.find((r) => r.id === source)?.product_id;
  const product = products?.find((p) => p.id === chosenProductId);
  const n = Object.fromEntries(FIELDS.map((f) => [f, Number(numbers[f] || 0)])) as Record<keyof Numbers, number>;
  const warning = n.clicks > n.views ? t.doctor.warnClicks : n.returns > n.orders ? t.doctor.warnReturns : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source) return setError(t.doctor.errReel);
    if (source === "other" && !productId) return setError(t.doctor.errProduct);
    if (n.views <= 0) return setError(t.doctor.errViews);
    if (warning) return setError(warning);
    setBusy(true);
    setStep(0);
    setError(null);
    try {
      const body = {
        ...(source === "other" ? { product_id: productId } : { reel_id: source }),
        ...n,
        ...(price && { selling_price_paise: Math.round(Number(price) * 100) }),
        ad_spend_paise: Math.round(Number(adSpend || 0) * 100),
      };
      const c = await apiFetch<Checkup>("/doctor", { method: "POST", body: JSON.stringify(body) });
      setResult(c);
      setHistory((h) => [c, ...(h ?? [])]);
      setTimeout(() => document.getElementById("diagnosis")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  const past = (history ?? []).filter((h) => h.id !== result?.id);
  const totals = (history ?? []).reduce(
    (t, h) => ({
      orders: t.orders + h.orders,
      returns: t.returns + h.returns,
      profit: t.profit + (h.diagnoses[0]?.money?.profit_paise ?? 0),
      withMoney: t.withMoney + (h.diagnoses[0]?.money ? 1 : 0),
    }),
    { orders: 0, returns: 0, profit: 0, withMoney: 0 },
  );

  return (
    <>
      <PageHero title={`🩺 ${t.doctor.title}`} subtitle={t.doctor.subtitle} tone="ocean">
        {history && history.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label={t.doctor.statCheckups} value={String(history.length)} />
            <Stat label={t.doctor.statOrders} value={`${totals.orders}`} note={totals.returns ? fmt(t.doctor.statReturned, { n: totals.returns }) : undefined} />
            <Stat
              label={t.doctor.statProfit}
              value={totals.withMoney ? `${totals.profit < 0 ? "−" : ""}${formatRupees(Math.abs(totals.profit))}` : "–"}
            />
          </div>
        ) : (
          history && (
            <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {t.doctor.how.map((s, i) => (
                <li key={s} className="rounded-xl bg-white/15 p-2 ring-1 ring-white/25">
                  <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-teal-700">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          )
        )}
      </PageHero>

      <form onSubmit={submit} className={`${card} mt-5 flex flex-col gap-4 p-4`}>
        <h2 className="text-lg font-bold text-brand-900">{t.doctor.newCheckup}</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t.doctor.whichReel}</span>
          {reels ? (
            <select value={source} onChange={(e) => setSource(e.target.value)} className={input}>
              <option value="">{t.doctor.choose}</option>
              {reels.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.products?.name ?? t.doctor.reel} · {languageLabel(r.language)} · {date(r.created_at)}
                </option>
              ))}
              <option value="other">{t.doctor.otherReel}</option>
            </select>
          ) : (
            <div className="h-12 animate-pulse rounded-xl bg-brand-50" />
          )}
        </label>
        {source === "other" && products && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t.doctor.productInReel}</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
              <option value="">{t.doctor.chooseProduct}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

        <fieldset>
          <legend className="text-sm font-semibold">{t.doctor.yourNumbers}</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f} className="flex flex-col gap-1">
                <span className="text-sm">{t.doctor[f]}</span>
                <input
                  inputMode="numeric"
                  value={numbers[f]}
                  onChange={(e) => setNumbers((x) => ({ ...x, [f]: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  placeholder="0"
                  className={`${input} tabular-nums`}
                />
                <span className="text-[11px] leading-tight text-neutral-500">{t.doctor[`${f}Hint`]}</span>
              </label>
            ))}
          </div>
          {warning && <p className="mt-2 text-sm text-red-700">{warning}</p>}
          <details className="mt-3 rounded-xl bg-brand-50/60 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-brand-800">{t.doctor.whereFind}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600">
              <li>{t.doctor.findViews}</li>
              <li>{t.doctor.findClicks}</li>
              <li>{t.doctor.findOrders}</li>
            </ul>
          </details>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">
            {t.doctor.money} <span className="font-normal text-neutral-500">{t.common.optional}</span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm">{t.doctor.priceSold}</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={product ? String(product.selling_price_paise / 100) : t.doctor.marketPrice}
                className={`${input} tabular-nums`}
              />
              <span className="text-[11px] leading-tight text-neutral-500">
                {product ? fmt(t.doctor.blankMarket, { price: formatRupees(product.selling_price_paise) }) : t.doctor.blankMarketGeneric}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">{t.doctor.adSpend}</span>
              <input
                inputMode="numeric"
                value={adSpend}
                onChange={(e) => setAdSpend(e.target.value.replace(/\D/g, "").slice(0, 7))}
                placeholder="0"
                className={`${input} tabular-nums`}
              />
              <span className="text-[11px] leading-tight text-neutral-500">{t.doctor.adSpendHint}</span>
            </label>
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className={btnPrimary} aria-live="polite">
          {busy ? WORKING[step] : `🩺 ${t.doctor.submit}`}
        </button>
      </form>

      {result && (
        <section id="diagnosis" className="mt-6 scroll-mt-20 animate-rise" aria-live="polite">
          <h2 className="mb-2 text-lg font-bold text-brand-900">{fmt(t.doctor.results, { name: result.products?.name ?? t.reel.yourReel })}</h2>
          <CheckupView c={result} previous={previousFor(result, history ?? [])} />
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-brand-900">{t.doctor.past}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((h) => {
              const d = h.diagnoses[0];
              const expanded = open === h.id;
              return (
                <li key={h.id} className={card}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : h.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-start justify-between gap-2 p-3 text-left text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold">{h.products?.name ?? t.doctor.reel}</span>
                      <span className="block text-xs text-neutral-500">
                        {fmt(t.doctor.pastLine, { date: date(h.entered_at), views: h.views.toLocaleString("en-IN"), orders: h.orders })}
                        {d?.money && ` · ${d.money.profit_paise < 0 ? "−" : ""}${formatRupees(Math.abs(d.money.profit_paise))}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {d && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${VERDICT_TONE[d.stage].tone}`}>
                          {t.checkup[`short${verdictKey(d.stage)}`]}
                        </span>
                      )}
                      <span aria-hidden className="text-brand-400">{expanded ? "▴" : "▾"}</span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-brand-50 p-3">
                      <CheckupView c={h} previous={previousFor(h, history ?? [])} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {history && history.length === 0 && reels?.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-600">
          {t.doctor.noReels} <Link href="/reels/new" className="font-bold text-brand-700 underline">{t.doctor.makeFirst}</Link>
        </p>
      )}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-2 ring-1 ring-white/25">
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-white/85">{label}</p>
      {note && <p className="text-[10px] text-white/70">{note}</p>}
    </div>
  );
}
