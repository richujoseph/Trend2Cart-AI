"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Clapperboard, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Messages } from "@/lib/i18n/en";
import { fmt, useT } from "@/lib/i18n";
import { type Simulation, formatRupees, formatRupeesWhole } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { ErrorState, LossTrapTag, ProductImage } from "@/components/states";
import { DataRow, EstimateTag, LevelBars, RibbonBackground, ScoreRing, btn, dataCard, glassCard } from "@/components/ui";

type Form = { price: string; rto: string; ad: string };

function simulate(id: string, body: object = {}) {
  return apiFetch<Simulation>(`/products/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Returns the API overrides, or a seller-friendly message if an input is invalid. */
function parseForm(form: Form, t: Messages): { body: object } | { error: string } {
  const price = Number(form.price);
  const rto = Number(form.rto);
  const ad = Number(form.ad);
  if (form.price === "" || !Number.isFinite(price) || price <= 0) return { error: t.product.errPrice };
  if (form.rto === "" || !Number.isFinite(rto) || rto < 0 || rto > 100) return { error: t.product.errRto };
  if (form.ad === "" || !Number.isFinite(ad) || ad < 0) return { error: t.product.errAd };
  return {
    body: {
      selling_price_paise: Math.round(price * 100),
      rto_rate: rto / 100,
      ad_cost_paise: Math.round(ad * 100),
    },
  };
}

export default function ProductDetail() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const [sim, setSim] = useState<Simulation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [edited, setEdited] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    simulate(id)
      .then((s) => {
        setSim(s);
        setForm({
          price: String(s.inputs.selling_price_paise / 100),
          rto: String(Math.round(s.estimates.rto_rate * 100)),
          ad: String(s.estimates.ad_cost_paise / 100),
        });
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id, attempt]);

  function retry() {
    setLoadError(null);
    setAttempt((a) => a + 1);
  }

  const parsed = form ? parseForm(form, t) : null;

  // Recalculate 400 ms after the seller stops typing or sliding.
  useEffect(() => {
    if (!edited || !form) return;
    const parsed = parseForm(form, t);
    if ("error" in parsed) return; // shown inline from render
    const timer = setTimeout(() => {
      const request = ++latestRequest.current;
      setUpdating(true);
      simulate(id, parsed.body)
        .then((s) => {
          if (request !== latestRequest.current) return;
          setSim(s);
          setCalcError(null);
        })
        .catch((e: Error) => request === latestRequest.current && setCalcError(e.message))
        .finally(() => request === latestRequest.current && setUpdating(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [form, edited, id, t]);

  function update(field: keyof Form, value: string) {
    setEdited(true);
    setCalcError(null);
    setForm((f) => (f ? { ...f, [field]: value } : f));
  }

  if (loadError) {
    return (
      <>
        <BackLink />
        <ErrorState message={loadError} onRetry={retry} />
      </>
    );
  }
  if (!sim || !form) return <DetailSkeleton />;

  const losing = sim.profit_paise <= 0;
  const market = sim.inputs.market_selling_price_paise / 100;

  const margin = Math.round((sim.profit_paise / sim.inputs.selling_price_paise) * 100);
  const comp = sim.competition_score;
  const compLevel = comp === null ? null : comp >= 60 ? 3 : comp >= 30 ? 2 : 1;

  return (
    <div className="relative">
      <RibbonBackground variant="subtle" className="-mx-5 -mt-4 h-80" />
      <div className="relative">
        <BackLink />
        <div className={`${glassCard} mt-3 flex gap-4 p-4`}>
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[16px] bg-card-muted p-1.5">
            <ProductImage src={sim.image_urls[0]} name={sim.name} className="h-full w-full rounded-[12px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ember-300">{t.categories[sim.category]}</p>
            <h1 className="mt-0.5 text-[22px] font-black leading-snug text-ink">{sim.name}</h1>
            {sim.mine ? (
              <p className="mt-1 text-xs text-ink-2">{t.product.unrated}</p>
            ) : (
              sim.supplier && <p className="mt-1 text-xs text-ink-2">{fmt(t.product.supplier, { name: sim.supplier })}</p>
            )}
            {sim.loss_trap && <div className="mt-1.5"><LossTrapTag /></div>}
          </div>
        </div>

        <section aria-live="polite" className={`${dataCard} mt-4 p-5 transition ${updating ? "opacity-70" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-black/55">{t.product.expectedProfit}</p>
              <p className={`mt-1 text-[32px] font-medium leading-none tabular-nums ${losing ? "text-loss-strong" : "text-profit-strong"}`}>
                {formatRupeesWhole(sim.profit_paise)}
              </p>
              {losing && <p className="mt-2 text-xs text-loss-strong">{t.product.losing}</p>}
            </div>
            {sim.score !== null && <ScoreRing value={sim.score} size={64} label={t.score.score} onWhite />}
          </div>
          <div className="mt-4">
            <DataRow label={t.product.marginLabel} value={`${margin}%`} strong />
            <DataRow label={t.product.searchTrend} value={sim.trend_score === null ? t.product.notChecked : `${sim.trend_score}/100`} />
            <DataRow
              label={t.product.competition}
              value={
                compLevel === null ? t.product.notChecked : (
                  <span className="inline-flex items-center gap-2">
                    {compLevel === 3 ? t.search.compHigh : compLevel === 2 ? t.search.compMedium : t.search.compLow}
                    <LevelBars level={compLevel} onWhite />
                  </span>
                )
              }
            />
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <SaveButton productId={sim.id} />
          <Link href={`/reels/new?product=${sim.id}`} className={btn.light}>
            <Clapperboard className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {t.product.makeReel}
          </Link>
        </div>

        <Breakdown sim={sim} />
        {sim.mine && <RemoveOwn id={sim.id} />}

        <section className={`${glassCard} mt-4 p-5`}>
          <h2 className="text-2xl font-black text-ink">{t.product.yourNumbers}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{t.product.yourNumbersSub}</p>
          <div className="mt-5 flex flex-col gap-6">
            <Field
              label={t.product.sellingPrice}
              prefix="₹"
              value={form.price}
              onChange={(v) => update("price", v)}
              min={Math.max(1, Math.round(market * 0.5))}
              max={Math.round(market * 2)}
              step={1}
              hint={fmt(t.product.marketPrice, { price: formatRupees(sim.inputs.market_selling_price_paise) })}
            />
            <Field
              label={t.product.rto}
              suffix="%"
              value={form.rto}
              onChange={(v) => update("rto", v)}
              min={0}
              max={60}
              step={1}
              hint={fmt(t.product.rtoHint, { category: t.categories[sim.category], pct: Math.round(sim.estimates.default_rto_rate * 100) })}
              onReset={() => update("rto", String(Math.round(sim.estimates.default_rto_rate * 100)))}
            />
            <Field
              label={t.product.adCost}
              prefix="₹"
              value={form.ad}
              onChange={(v) => update("ad", v)}
              min={0}
              max={300}
              step={5}
              hint={
                sim.estimates.default_ad_cost_paise === 0
                  ? t.product.adHintZero
                  : fmt(t.product.adHint, { price: formatRupees(sim.estimates.default_ad_cost_paise) })
              }
              onReset={() => update("ad", String(sim.estimates.default_ad_cost_paise / 100))}
            />
          </div>
          {sim.estimates.source && (
            <details className="mt-5 border-t border-sage/30 pt-4 text-[13px] text-ink-2">
              <summary className="cursor-pointer font-medium text-ember-300">{t.product.sourcesTitle}</summary>
              {sim.selling_price_source && <p className="mt-2">{fmt(t.product.sourcesMarket, { source: sim.selling_price_source })}</p>}
              <p className="mt-2">{t.product.sourcesTrend}</p>
              <p className="mt-2">{sim.estimates.source}</p>
              <p className="mt-2">{t.product.sourcesSupplier}</p>
            </details>
          )}
          {(() => {
            const message = parsed && "error" in parsed ? parsed.error : calcError;
            return message && <p role="alert" className="mt-4 rounded-[16px] bg-loss/10 p-3 text-sm text-loss">{message}</p>;
          })()}
        </section>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  hint: string;
  prefix?: string;
  suffix?: string;
  onReset?: () => void;
}) {
  const { t } = useT();
  const id = `field-${props.prefix ?? ""}${props.suffix ?? ""}-${props.min}-${props.max}`;
  const numeric = Number(props.value);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[15px] font-medium text-ink">{props.label}</label>
        <EstimateTag />
      </div>
      <p className="text-[13px] text-ink-2">{t.product.estimateEdit}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          aria-label={fmt(t.product.slider, { label: props.label })}
          min={props.min}
          max={props.max}
          step={props.step}
          value={Number.isFinite(numeric) ? numeric : props.min}
          onChange={(e) => props.onChange(e.target.value)}
          className="h-2 flex-1 accent-ember-400"
        />
        <div className="glass flex h-12 w-28 items-center rounded-[16px] px-3 focus-within:border-ember-300/60">
          {props.prefix && <span className="text-ink-2">{props.prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full bg-transparent px-1 text-right text-[15px] font-medium tabular-nums text-ink outline-none"
          />
          {props.suffix && <span className="text-ink-2">{props.suffix}</span>}
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-ink-2">
        <span>{props.hint}</span>
        {props.onReset && (
          <button type="button" onClick={props.onReset} className="min-h-11 shrink-0 px-2 font-medium text-ember-300">{t.common.reset}</button>
        )}
      </div>
    </div>
  );
}

function Breakdown({ sim }: { sim: Simulation }) {
  const { t } = useT();
  const b = sim.breakdown;
  const rows = [
    { label: t.product.rowCollect, value: b.revenue, kind: "in" },
    { label: t.product.rowSupplier, value: b.supplier_cost, kind: "out" },
    { label: t.product.rowShipping, value: b.shipping, kind: "out" },
    { label: t.product.rowFees, value: b.fees, kind: "out" },
    { label: t.product.rowReturns, value: b.rto_shipping_loss, kind: "out" },
    { label: t.product.rowAds, value: b.ad_cost, kind: "out" },
  ] as const;
  const scale = Math.max(b.revenue, 1);
  const losing = sim.profit_paise <= 0;

  return (
    <section className={`${dataCard} mt-4 p-5`}>
      <h2 className="text-2xl font-black">{t.product.breakdownTitle}</h2>
      <p className="mt-1 text-[13px] text-black/55">
        {fmt(t.product.breakdownSub, { price: formatRupees(sim.inputs.selling_price_paise), pct: Math.round(sim.estimates.rto_rate * 100) })}
      </p>
      <ul className="mt-4">
        {rows.map((r) => (
          <li key={r.label} className="border-t border-black/[0.08] py-2.5">
            <div className="flex justify-between gap-3 text-[15px]">
              <span className="text-black/70">{r.kind === "out" ? "− " : ""}{r.label}</span>
              <span className="shrink-0 tabular-nums text-black/85">{formatRupees(r.value)}</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-black/[0.06]">
              <div
                className={`h-1 rounded-full ${r.kind === "in" ? "bg-rust-500" : "bg-black/25"}`}
                style={{ width: `${Math.min(100, (r.value / scale) * 100)}%` }}
              />
            </div>
          </li>
        ))}
        <li className="border-t border-black/15 pt-3">
          <div className="flex justify-between text-[15px] font-medium">
            <span>{t.product.yourProfit}</span>
            <span className={`tabular-nums ${losing ? "text-loss-strong" : "text-profit-strong"}`}>{formatRupees(sim.profit_paise)}</span>
          </div>
        </li>
      </ul>
    </section>
  );
}

function SaveButton({ productId }: { productId: string }) {
  const { t } = useT();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("saved_products")
      .select("product_id")
      .eq("product_id", productId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [productId]);

  async function toggle() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return setError(t.product.saveSignIn);
    setError(null);
    const next = !saved;
    setSaved(next);
    const { error } = next
      ? await supabase.from("saved_products").insert({ user_id: userId, product_id: productId })
      : await supabase.from("saved_products").delete().eq("user_id", userId).eq("product_id", productId);
    if (error) {
      setSaved(!next);
      setError(t.product.saveError);
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={saved === null}
        aria-pressed={!!saved}
        className={`${btn.glass} w-full ${saved ? "text-ember-300" : ""}`}
      >
        {saved ? t.product.saved : t.product.save}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}

function RemoveOwn({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/products/mine/${id}`, { method: "DELETE" });
      router.replace("/products");
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }
  return (
    <div className="mt-6">
      <button onClick={remove} disabled={busy} className={`${btn.ghost} w-full text-loss`}>
        <Trash2 className="h-4 w-4" aria-hidden /> {busy ? t.product.removing : t.product.remove}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}

function BackLink() {
  const { t } = useT();
  return (
    <Link href="/products" className={`${btn.ghost} -ml-3`}>
      {t.product.allProducts}
    </Link>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading product">
      <div className="h-4 w-24 rounded skeleton-dark" />
      <div className="mt-3 flex gap-3">
        <div className="h-24 w-24 rounded-xl skeleton-dark" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded skeleton-dark" />
          <div className="h-5 w-3/4 rounded skeleton-dark" />
        </div>
      </div>
      <div className="mt-4 h-24 rounded-xl skeleton-dark" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-12 rounded-lg skeleton-dark" />
        <div className="h-12 rounded-lg skeleton-dark" />
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 rounded skeleton-dark" />
        ))}
      </div>
    </div>
  );
}
