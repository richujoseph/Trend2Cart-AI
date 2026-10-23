"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { type Simulation, categoryLabel, formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { ErrorState, LossTrapTag, ProductImage, ScoreBadge } from "@/components/states";

type Form = { price: string; rto: string; ad: string };

function simulate(id: string, body: object = {}) {
  return apiFetch<Simulation>(`/products/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Returns the API overrides, or a seller-friendly message if an input is invalid. */
function parseForm(form: Form): { body: object } | { error: string } {
  const price = Number(form.price);
  const rto = Number(form.rto);
  const ad = Number(form.ad);
  if (form.price === "" || !Number.isFinite(price) || price <= 0) return { error: "Enter a selling price above ₹0." };
  if (form.rto === "" || !Number.isFinite(rto) || rto < 0 || rto > 100) return { error: "Returns (RTO) must be between 0% and 100%." };
  if (form.ad === "" || !Number.isFinite(ad) || ad < 0) return { error: "Ad cost can't be negative." };
  return {
    body: {
      selling_price_paise: Math.round(price * 100),
      rto_rate: rto / 100,
      ad_cost_paise: Math.round(ad * 100),
    },
  };
}

export default function ProductDetail() {
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

  const parsed = form ? parseForm(form) : null;

  // Recalculate 400 ms after the seller stops typing or sliding.
  useEffect(() => {
    if (!edited || !form) return;
    const parsed = parseForm(form);
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
  }, [form, edited, id]);

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
      <div className="mt-3 flex gap-3">
        <ProductImage src={sim.image_urls[0]} name={sim.name} className="h-24 w-24 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-500">{categoryLabel(sim.category)}</p>
          <h1 className="text-lg font-bold leading-tight">{sim.name}</h1>
          {sim.supplier && <p className="mt-0.5 text-xs text-neutral-500">Supplier: {sim.supplier}</p>}
          {sim.loss_trap && <div className="mt-1"><LossTrapTag /></div>}
        </div>
      </div>

      <section
        aria-live="polite"
        className={`mt-4 flex items-center justify-between rounded-xl p-4 ${losing ? "bg-red-50" : "bg-emerald-50"} ${updating ? "opacity-60" : ""}`}
      >
        <div>
          <p className="text-xs text-neutral-600">Expected profit per order</p>
          <p className={`text-3xl font-bold tabular-nums ${losing ? "text-red-600" : "text-emerald-700"}`}>
            {formatRupees(sim.profit_paise)}
          </p>
          {losing && <p className="mt-1 text-xs text-red-700">You lose money on every order at these numbers.</p>}
        </div>
        <ScoreBadge score={sim.score} />
      </section>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Fact label="Trend (Kerala + TN)" value={sim.trend_score} />
        <Fact label="Competition" value={sim.competition_score} />
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SaveButton productId={sim.id} />
        <Link
          href={`/reels/new?product=${sim.id}`}
          className="flex h-12 items-center justify-center rounded-lg bg-neutral-900 font-medium text-white"
        >
          Make a Reel
        </Link>
      </div>

      <Breakdown sim={sim} />

      <section className="mt-6">
        <h2 className="font-semibold">Your numbers</h2>
        <p className="text-xs text-neutral-500">Change these to see your real profit. Starting values are our estimates.</p>
        <div className="mt-3 flex flex-col gap-5">
          <Field
            label="Selling price"
            prefix="₹"
            value={form.price}
            onChange={(v) => update("price", v)}
            min={Math.max(1, Math.round(market * 0.5))}
            max={Math.round(market * 2)}
            step={1}
            hint={`Market price ${formatRupees(sim.inputs.market_selling_price_paise)}`}
          />
          <Field
            label="Orders returned (RTO)"
            suffix="%"
            value={form.rto}
            onChange={(v) => update("rto", v)}
            min={0}
            max={60}
            step={1}
            hint={`Our estimate for ${categoryLabel(sim.category).toLowerCase()}: ${Math.round(sim.estimates.default_rto_rate * 100)}%`}
            onReset={() => update("rto", String(Math.round(sim.estimates.default_rto_rate * 100)))}
          />
          <Field
            label="Ad cost per order"
            prefix="₹"
            value={form.ad}
            onChange={(v) => update("ad", v)}
            min={0}
            max={300}
            step={5}
            hint={
              sim.estimates.default_ad_cost_paise === 0
                ? "Default ₹0: organic Reels, no paid ads"
                : `Our estimate: ${formatRupees(sim.estimates.default_ad_cost_paise)}`
            }
            onReset={() => update("ad", String(sim.estimates.default_ad_cost_paise / 100))}
          />
        </div>
        {sim.estimates.source && (
          <details className="mt-4 text-xs text-neutral-600">
            <summary className="cursor-pointer font-medium">Where these numbers come from</summary>
            {sim.selling_price_source && <p className="mt-2">Market price: {sim.selling_price_source}.</p>}
            <p className="mt-2">{sim.estimates.source}</p>
            <p className="mt-2">
              Supplier price is a real wholesale listing including 18% GST. Shipping and COD fees use
              Shiprocket&apos;s published rates (₹45 per 500 g, COD ₹27 + 1.5%, min ₹37, plus 18% GST).
            </p>
          </details>
        )}
        {(() => {
          const message = parsed && "error" in parsed ? parsed.error : calcError;
          return message && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>;
        })()}
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={value === null ? "text-neutral-400" : "text-base font-semibold tabular-nums"}>
        {value === null ? "Not checked yet" : `${value}/100`}
      </dd>
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
  const id = props.label.toLowerCase().replace(/\W+/g, "-");
  const numeric = Number(props.value);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">{props.label}</label>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Estimate</span>
      </div>
      <p className="text-xs text-neutral-500">Estimate — edit to match your business</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          aria-label={`${props.label} slider`}
          min={props.min}
          max={props.max}
          step={props.step}
          value={Number.isFinite(numeric) ? numeric : props.min}
          onChange={(e) => props.onChange(e.target.value)}
          className="h-2 flex-1 accent-neutral-900"
        />
        <div className="flex h-11 w-28 items-center rounded-lg border border-neutral-300 bg-white px-2 focus-within:border-neutral-900">
          {props.prefix && <span className="text-neutral-500">{props.prefix}</span>}
          <input
            id={id}
            inputMode="decimal"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value.replace(/[^\d.]/g, ""))}
            className="w-full bg-transparent px-1 text-right tabular-nums outline-none"
          />
          {props.suffix && <span className="text-neutral-500">{props.suffix}</span>}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>{props.hint}</span>
        {props.onReset && (
          <button type="button" onClick={props.onReset} className="underline">Reset</button>
        )}
      </div>
    </div>
  );
}

function Breakdown({ sim }: { sim: Simulation }) {
  const b = sim.breakdown;
  const rows = [
    { label: "You collect (after returns)", value: b.revenue, kind: "in" },
    { label: "Supplier", value: b.supplier_cost, kind: "out" },
    { label: "Shipping", value: b.shipping, kind: "out" },
    { label: "COD, payment & GST fees", value: b.fees, kind: "out" },
    { label: "Returned orders (shipping both ways)", value: b.rto_shipping_loss, kind: "out" },
    { label: "Ads", value: b.ad_cost, kind: "out" },
  ] as const;
  const scale = Math.max(b.revenue, 1);
  const losing = sim.profit_paise <= 0;

  return (
    <section className="mt-6">
      <h2 className="font-semibold">Where your money goes</h2>
      <p className="text-xs text-neutral-500">
        Average per order. Sells at {formatRupees(sim.inputs.selling_price_paise)}, but{" "}
        {Math.round(sim.estimates.rto_rate * 100)}% of orders come back and pay nothing.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-700">{r.kind === "out" ? "− " : ""}{r.label}</span>
              <span className="tabular-nums">{formatRupees(r.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-neutral-100">
              <div
                className={`h-2 rounded-full ${r.kind === "in" ? "bg-neutral-800" : "bg-neutral-400"}`}
                style={{ width: `${Math.min(100, (r.value / scale) * 100)}%` }}
              />
            </div>
          </li>
        ))}
        <li className="border-t border-neutral-200 pt-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>= Your profit</span>
            <span className={`tabular-nums ${losing ? "text-red-600" : "text-emerald-700"}`}>{formatRupees(sim.profit_paise)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
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
    if (!userId) return setError("Please sign in to save products.");
    setError(null);
    const next = !saved;
    setSaved(next);
    const { error } = next
      ? await supabase.from("saved_products").insert({ user_id: userId, product_id: productId })
      : await supabase.from("saved_products").delete().eq("user_id", userId).eq("product_id", productId);
    if (error) {
      setSaved(!next);
      setError("Couldn't update your saved list. Please try again.");
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={saved === null}
        aria-pressed={!!saved}
        className="h-12 w-full rounded-lg border border-neutral-300 bg-white font-medium disabled:opacity-50"
      >
        {saved ? "★ Saved" : "☆ Save"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/products" className="text-sm text-neutral-600">
      ← All products
    </Link>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading product">
      <div className="h-4 w-24 rounded bg-neutral-200" />
      <div className="mt-3 flex gap-3">
        <div className="h-24 w-24 rounded-xl bg-neutral-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-neutral-200" />
          <div className="h-5 w-3/4 rounded bg-neutral-200" />
        </div>
      </div>
      <div className="mt-4 h-24 rounded-xl bg-neutral-200" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-12 rounded-lg bg-neutral-200" />
        <div className="h-12 rounded-lg bg-neutral-200" />
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 rounded bg-neutral-200" />
        ))}
      </div>
    </div>
  );
}
