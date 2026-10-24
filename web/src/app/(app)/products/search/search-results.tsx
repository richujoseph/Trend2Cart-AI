"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Estimate, Lookup } from "@/lib/discover";
import { fmt, useT } from "@/lib/i18n";
import { CATEGORIES, type Category, formatRupees } from "@/lib/products";
import { ApiError } from "@/lib/api";
import { CheckCircle2, PackagePlus } from "lucide-react";
import { ErrorState, ProductImage } from "@/components/states";
import { ChangeBadge, EstimateTag, SectionTitle, Sparkline, btnPrimary, btnSecondary, card, input, tile } from "@/components/ui";

export default function SearchResults() {
  const { t } = useT();
  const q = useSearchParams().get("q") ?? "";
  const [result, setResult] = useState<{ q: string; data?: Lookup; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    apiFetch<Lookup>(`/discover/search?q=${encodeURIComponent(q)}`)
      .then((data) => !stale && setResult({ q, data }))
      .catch((e: Error) => !stale && setResult({ q, error: e.message }));
    return () => {
      stale = true;
    };
  }, [q, attempt]);

  const current = result?.q === q ? result : null;

  return (
    <>
      <Link href="/products" className="text-sm font-medium text-brand-700">{t.search.back}</Link>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-500">{t.search.title}</p>
      <h1 className="text-2xl font-medium capitalize tracking-tight text-brand-900">{q}</h1>

      {current?.error && <ErrorState message={current.error} onRetry={() => setAttempt((a) => a + 1)} />}
      {!current && <Checking />}
      {current?.data && <Results d={current.data} />}
    </>
  );
}

function Checking() {
  const { t } = useT();
  return (
    <div aria-busy className="mt-4">
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden />
        {t.search.checking}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card-muted" />)}
      </div>
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-card-muted" />
    </div>
  );
}

function Results({ d }: { d: Lookup }) {
  const { t, date } = useT();
  const router = useRouter();
  const comp = d.competition_score >= 60 ? t.search.compHigh : d.competition_score >= 30 ? t.search.compMedium : t.search.compLow;
  const region = { "Kerala + Tamil Nadu": t.search.regionKeralaTn, India: t.search.regionIndia, none: t.search.regionNone }[d.trend_region];
  return (
    <div className="animate-rise">
      <p className="mt-1 text-xs text-ink-2">
        {d.cached ? fmt(t.search.cached, { date: date(d.fetched_at) }) : t.search.live} · Google Shopping India
      </p>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`${tile} col-span-2 flex items-center gap-3 p-4`}>
          <ProductImage src={d.image_url ?? undefined} name={d.query} className="h-20 w-20 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-xs text-ink-2">{t.search.typicalPrice}</p>
            {d.market_price_paise ? (
              <p className="text-3xl font-medium tabular-nums text-brand-900">{formatRupees(d.market_price_paise)}</p>
            ) : (
              <p className="text-sm text-ink-2">{t.search.tooFewPrices}</p>
            )}
            {d.price_low_paise && d.price_high_paise && (
              <p className="text-xs text-ink-2">
                {fmt(t.search.priceRange, { low: formatRupees(d.price_low_paise), high: formatRupees(d.price_high_paise) })}
              </p>
            )}
          </div>
        </div>
        <Stat label={t.search.sellers} value={String(d.sellers)} note={fmt(t.search.sellersValue, { n: d.listings_count })} />
        <Stat label={t.search.competition} value={comp} note={`${d.competition_score}/100`} tone={d.competition_score >= 60 ? "text-red" : d.competition_score >= 30 ? "text-charcoal" : "text-profit"} />
        <div className={`${tile} col-span-2 p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-ink-2">{t.search.interest}</p>
              <p className="text-2xl font-medium tabular-nums text-brand-900">{d.trend_score}<span className="text-sm font-medium text-ink-3">/100</span></p>
            </div>
            {d.trend_change_pct !== null && (
              <span className="flex flex-col items-end gap-0.5 text-right">
                <ChangeBadge pct={d.trend_change_pct} />
                <span className="text-[11px] text-ink-2">{t.products.vsEarlier}</span>
              </span>
            )}
          </div>
          <Sparkline points={d.weekly} className="mt-2 h-14 w-full" />
          <p className="mt-1 text-[11px] text-ink-2">{fmt(t.search.region, { region })}</p>
        </div>
      </div>

      <div className="lg:sticky lg:top-28 lg:[&>section]:mt-4">
        <Estimator d={d} />
      </div>
      </div>

      {d.listings.length > 0 && (
        <section className="mt-6">
          <SectionTitle title={t.search.listingsTitle} subtitle={t.search.listingsSub} />
          <ul className="mt-3 grid gap-2 lg:grid-cols-2 lg:gap-3">
            {d.listings.map((l, i) => (
              <li key={`${l.title}-${i}`} className={`${tile} flex items-center gap-3 p-3`}>
                <ProductImage src={l.thumbnail ?? undefined} name={l.title} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{l.title}</p>
                  <p className="text-xs text-ink-2">
                    <b className="text-ink">{formatRupees(l.price_paise)}</b>
                    {l.source && ` · ${l.source}`}
                    {l.rating ? ` · ★ ${l.rating}` : ""}
                  </p>
                </div>
                {l.link?.startsWith("http") && (
                  <a href={l.link} target="_blank" rel="noreferrer noopener" className="flex h-10 shrink-0 items-center px-2 text-sm font-semibold text-brand-700">
                    {t.search.open} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button onClick={() => router.push("/products")} className={`${btnSecondary} mt-6 w-full`}>{t.search.again}</button>
    </div>
  );
}

function Stat({ label, value, note, tone = "text-brand-900" }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className={`${tile} p-4`}>
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`text-xl font-medium ${tone}`}>{value}</p>
      {note && <p className="text-[11px] text-ink-2">{note}</p>}
    </div>
  );
}

function Estimator({ d }: { d: Lookup }) {
  const { t } = useT();
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState(d.market_price_paise ? String(d.market_price_paise / 100) : "");
  const [rto, setRto] = useState("22");
  const [ad, setAd] = useState("0");
  const [est, setEst] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const ready = Number(cost) > 0 && Number(price) > 0 && rto !== "" && Number(rto) <= 100;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const request = ++latest.current;
      apiFetch<Estimate>("/discover/estimate", {
        method: "POST",
        body: JSON.stringify({
          selling_price_paise: Math.round(Number(price) * 100),
          supplier_price_paise: Math.round(Number(cost) * 100),
          rto_rate: Number(rto) / 100,
          ad_cost_paise: Math.round(Number(ad || 0) * 100),
        }),
      })
        .then((e) => request === latest.current && (setEst(e), setError(null)))
        .catch((e: Error) => request === latest.current && setError(e.message));
    }, 350);
    return () => clearTimeout(timer);
  }, [ready, cost, price, rto, ad]);

  const num = (set: (v: string) => void, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(e.target.value.replace(/[^\d.]/g, "").slice(0, max));
  const shown = ready ? est : null;
  const losing = shown && shown.profit_paise <= 0;

  return (
    <section className={`${card} mt-6 overflow-hidden`}>
      <div className="bg-card-muted p-5">
        <h2 className="text-xl font-black text-ink">{t.search.estimateTitle}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.search.supplierCost}</span>
          <input inputMode="decimal" value={cost} onChange={num(setCost, 7)} placeholder="0" className={`${input} tabular-nums`} />
          <span className="flex flex-wrap justify-between gap-1 text-[11px] text-ink-2">
            {t.search.supplierHint}
            <a href={`https://dir.indiamart.com/search.mp?ss=${encodeURIComponent(d.query)}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">
              {t.search.findSupplier}
            </a>
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.search.sellPrice}</span>
          <input inputMode="decimal" value={price} onChange={num(setPrice, 7)} className={`${input} tabular-nums`} />
          {d.market_price_paise && <span className="text-[11px] text-ink-2">{fmt(t.search.sellHint, { price: formatRupees(d.market_price_paise) })}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-sm font-semibold">{t.search.rtoLabel} <EstimateTag /></span>
          <input inputMode="numeric" value={rto} onChange={num(setRto, 3)} className={`${input} tabular-nums`} />
          <span className="text-[11px] text-ink-2">{t.search.rtoHint}</span>
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="flex items-center gap-1 text-sm font-semibold">{t.search.adLabel} <EstimateTag /></span>
          <input inputMode="decimal" value={ad} onChange={num(setAd, 6)} className={`${input} tabular-nums`} />
        </label>
      </div>
      <div className={`border-t border-sage/30 p-4 ${losing ? "bg-red/10" : shown ? "bg-profit/10" : ""}`} aria-live="polite">
        {!shown && !error && <p className="text-sm text-ink-2">{t.search.enterCost}</p>}
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
        {shown && (
          <>
            <p className="text-xs text-ink-2">{t.search.profitPerOrder}</p>
            <p className={`text-3xl font-medium tabular-nums ${losing ? "text-red" : "text-profit"}`}>{formatRupees(shown.profit_paise)}</p>
            <p className="mt-1 text-xs text-ink-2">
              {fmt(t.search.afterAll, { ship: formatRupees(shown.shipping_paise), fee: formatRupees(shown.fees_paise) })}
            </p>
            {losing && <p className="mt-1 text-xs font-semibold text-red">{t.search.losing}</p>}
          </>
        )}
      </div>
      {shown && <AddToShop d={d} cost={Math.round(Number(cost) * 100)} price={Math.round(Number(price) * 100)} />}
    </section>
  );
}

function AddToShop({ d, cost, price }: { d: Lookup; cost: number; price: number }) {
  const { t } = useT();
  const [name, setName] = useState(d.query.replace(/\b\w/g, (c) => c.toUpperCase()));
  const [category, setCategory] = useState<Category>("home_gadgets");
  const [slabs, setSlabs] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function add() {
    if (name.trim().length < 3) return setError(t.search.errName);
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ id: string }>("/products/mine", {
        method: "POST",
        body: JSON.stringify({ query: d.query, name: name.trim(), category, supplier_price_paise: cost, selling_price_paise: price, weight_slabs: slabs }),
      });
      setAdded(r.id);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (added) {
    return (
      <div className="flex items-center gap-3 border-t border-sage/30 bg-brand-50/60 p-4" role="status">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-profit" aria-hidden />
        <p className="flex-1 text-sm font-normal text-ink">{t.search.added}</p>
        <Link href={`/products/${added}`} className="text-sm font-bold text-brand-700">{t.search.openProduct}</Link>
      </div>
    );
  }
  return (
    <div className="border-t border-sage/30 p-4">
      <p className="flex items-center gap-1.5 font-normal text-ink">
        <PackagePlus className="h-5 w-5 text-charcoal" aria-hidden /> {t.search.addTitle}
      </p>
      <p className="text-xs text-ink-2">{t.search.addSub}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.search.nameLabel}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.search.categoryLabel}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={input}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t.search.weightLabel}</span>
          <select value={slabs} onChange={(e) => setSlabs(Number(e.target.value))} className={input}>
            {t.search.weights.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="mt-2 rounded-xl bg-red/10 p-2 text-sm text-red">{error}</p>}
      <button onClick={add} disabled={busy} className={`${btnPrimary} mt-3 w-full`}>
        <PackagePlus className="h-4 w-4" aria-hidden /> {busy ? t.search.adding : t.search.addButton}
      </button>
    </div>
  );
}
