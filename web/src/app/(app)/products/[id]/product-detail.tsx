"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Messages } from "@/lib/i18n/en";
import { fmt, useT } from "@/lib/i18n";
import { type Simulation, formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { ErrorState, LossTrapTag, ProductImage, ScoreBadge } from "@/components/states";
import { EstimateTag, btnPrimary, btnSecondary, card } from "@/components/ui";

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

  return (
    <>
      <BackLink />
      <div className={`${card} mt-3 flex gap-3 p-3`}>
        <ProductImage src={sim.image_urls[0]} name={sim.name} className="h-28 w-28 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{t.categories[sim.category]}</p>
          <h1 className="text-lg font-medium leading-tight text-brand-900">{sim.name}</h1>
          {sim.mine ? (
            <p className="mt-1 text-xs text-ink-2">{t.product.unrated}</p>
          ) : (
            sim.supplier && <p className="mt-1 text-xs text-ink-2">{fmt(t.product.supplier, { name: sim.supplier })}</p>
          )}
          {sim.loss_trap && <div className="mt-1"><LossTrapTag /></div>}
        </div>
      </div>

      <section
        aria-live="polite"
        className={`mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg ${
          losing ? "from-[#4a0d08] to-[#c42f1c] shadow-red-600/20" : "from-[#06301f] to-[#138a5b] shadow-emerald-600/20"
        } ${updating ? "opacity-70" : ""}`}
      >
        <div>
          <p className="text-xs text-white/85">{t.product.expectedProfit}</p>
          <p className="text-4xl font-medium tabular-nums">{formatRupees(sim.profit_paise)}</p>
          {losing && <p className="mt-1 text-xs text-white/90">{t.product.losing}</p>}
        </div>
        <span className="rounded-xl bg-white/20 p-1"><ScoreBadge score={sim.score} /></span>
      </section>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Fact label={t.product.searchTrend} value={sim.trend_score} />
        <Fact label={t.product.competition} value={sim.competition_score} />
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SaveButton productId={sim.id} />
        <Link href={`/reels/new?product=${sim.id}`} className={btnPrimary}>
          {t.product.makeReel}
        </Link>
      </div>

      <Breakdown sim={sim} />
      {sim.mine && <RemoveOwn id={sim.id} />}

      <section className={`${card} mt-4 p-4`}>
        <h2 className="text-xl font-light text-ink">{t.product.yourNumbers}</h2>
        <p className="text-xs text-ink-2">{t.product.yourNumbersSub}</p>
        <div className="mt-4 flex flex-col gap-5">
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
          <details className="mt-4 text-xs text-ink-2">
            <summary className="cursor-pointer font-semibold text-brand-700">{t.product.sourcesTitle}</summary>
            {sim.selling_price_source && <p className="mt-2">{fmt(t.product.sourcesMarket, { source: sim.selling_price_source })}</p>}
            <p className="mt-2">{t.product.sourcesTrend}</p>
            <p className="mt-2">{sim.estimates.source}</p>
            <p className="mt-2">{t.product.sourcesSupplier}</p>
          </details>
        )}
        {(() => {
          const message = parsed && "error" in parsed ? parsed.error : calcError;
          return message && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{message}</p>;
        })()}
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: number | null }) {
  const { t } = useT();
  return (
    <div className={`${card} p-3`}>
      <dt className="text-ink-2">{label}</dt>
      <dd className={value === null ? "text-ink-3" : "text-lg font-medium tabular-nums text-brand-900"}>
        {value === null ? t.product.notChecked : `${value}/100`}
      </dd>
      {value !== null && (
        <div className="mt-1 h-1.5 rounded-full bg-brand-50">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-orange-500" style={{ width: `${value}%` }} />
        </div>
      )}
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
        <label htmlFor={id} className="text-sm font-semibold">{props.label}</label>
        <EstimateTag />
      </div>
      <p className="text-xs text-ink-2">{t.product.estimateEdit}</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          aria-label={fmt(t.product.slider, { label: props.label })}
          min={props.min}
          max={props.max}
          step={props.step}
          value={Number.isFinite(numeric) ? numeric : props.min}
          onChange={(e) => props.onChange(e.target.value)}
          className="h-2 flex-1 accent-brand-600"
        />
        <div className="flex h-11 w-28 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 focus-within:border-brand-500">
          {props.prefix && <span className="text-ink-2">{props.prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full bg-transparent px-1 text-right tabular-nums outline-none"
          />
          {props.suffix && <span className="text-ink-2">{props.suffix}</span>}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-2">
        <span>{props.hint}</span>
        {props.onReset && (
          <button type="button" onClick={props.onReset} className="font-semibold text-brand-700 underline">{t.common.reset}</button>
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
    <section className={`${card} mt-4 p-4`}>
      <h2 className="text-xl font-light text-ink">{t.product.breakdownTitle}</h2>
      <p className="text-xs text-ink-2">
        {fmt(t.product.breakdownSub, { price: formatRupees(sim.inputs.selling_price_paise), pct: Math.round(sim.estimates.rto_rate * 100) })}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between text-sm">
              <span className="text-ink/85">{r.kind === "out" ? "− " : ""}{r.label}</span>
              <span className="tabular-nums">{formatRupees(r.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/[0.06]">
              <div
                className={`h-2 rounded-full ${r.kind === "in" ? "bg-gradient-to-r from-brand-500 to-orange-500" : "bg-brand-200"}`}
                style={{ width: `${Math.min(100, (r.value / scale) * 100)}%` }}
              />
            </div>
          </li>
        ))}
        <li className="border-t border-white/[0.07] pt-2">
          <div className="flex justify-between text-sm font-bold">
            <span>{t.product.yourProfit}</span>
            <span className={`tabular-nums ${losing ? "text-red-400" : "text-emerald-400"}`}>{formatRupees(sim.profit_paise)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-white/[0.06]">
            <div
              className={`h-2 rounded-full ${losing ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, (Math.abs(sim.profit_paise) / scale) * 100)}%` }}
            />
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
        className={`${btnSecondary} w-full ${saved ? "bg-amber-400/10 text-amber-300 ring-amber-400/25" : ""}`}
      >
        {saved ? t.product.saved : t.product.save}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
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
      <button onClick={remove} disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-red-400 ring-1 ring-red-500/30 disabled:opacity-50">
        <Trash2 className="h-4 w-4" aria-hidden /> {busy ? t.product.removing : t.product.remove}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function BackLink() {
  const { t } = useT();
  return (
    <Link href="/products" className="text-sm font-medium text-brand-700">
      {t.product.allProducts}
    </Link>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading product">
      <div className="h-4 w-24 rounded bg-brand-50" />
      <div className="mt-3 flex gap-3">
        <div className="h-24 w-24 rounded-xl bg-brand-50" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-brand-50" />
          <div className="h-5 w-3/4 rounded bg-brand-50" />
        </div>
      </div>
      <div className="mt-4 h-24 rounded-xl bg-brand-50" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-12 rounded-lg bg-brand-50" />
        <div className="h-12 rounded-lg bg-brand-50" />
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 rounded bg-brand-50" />
        ))}
      </div>
    </div>
  );
}
