"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Checkup, VERDICT } from "@/lib/doctor";
import { type ProductListItem, formatRupees } from "@/lib/products";
import { type Reel, languageLabel, shortDate } from "@/lib/reels";
import { ErrorState } from "@/components/states";
import CheckupView from "./checkup";

const FIELDS = [
  { key: "views", label: "Views", hint: "Plays on the Reel" },
  { key: "clicks", label: "DMs or link clicks", hint: "People who messaged or tapped your link" },
  { key: "orders", label: "Orders", hint: "Confirmed orders from this Reel" },
  { key: "returns", label: "Returned or refused", hint: "COD parcels that came back" },
] as const;
type Numbers = Record<(typeof FIELDS)[number]["key"], string>;

const WORKING = ["Checking your funnel…", "Working out your profit…", "Writing your advice…"];

/** The earlier check-up for the same product, to show progress. */
function previousFor(c: Checkup, all: Checkup[]): Checkup | undefined {
  return all.find((x) => x.id !== c.id && x.product_id === c.product_id && x.entered_at < c.entered_at);
}

export default function Doctor() {
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
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WORKING.length - 1)), 2500);
    return () => clearInterval(t);
  }, [busy]);

  const chosenProductId = source === "other" ? productId : reels?.find((r) => r.id === source)?.product_id;
  const product = products?.find((p) => p.id === chosenProductId);
  const n = Object.fromEntries(FIELDS.map((f) => [f.key, Number(numbers[f.key] || 0)])) as Record<keyof Numbers, number>;
  const warning =
    n.clicks > n.views ? "DMs/clicks can't be more than views." : n.returns > n.orders ? "Returns can't be more than orders." : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source) return setError("Pick the Reel these numbers are for.");
    if (source === "other" && !productId) return setError("Pick the product this Reel was about.");
    if (n.views <= 0) return setError("Enter how many people viewed your Reel.");
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
      <h1 className="text-xl font-bold">Conversion Doctor</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Posted a Reel? Enter its numbers. We&apos;ll show what it earned, where buyers drop off, and what to do next.
      </p>

      {history && history.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Check-ups" value={String(history.length)} />
          <Stat label="Orders" value={`${totals.orders}`} note={totals.returns ? `${totals.returns} returned` : undefined} />
          <Stat
            label="Profit"
            value={totals.withMoney ? `${totals.profit < 0 ? "−" : ""}${formatRupees(Math.abs(totals.profit))}` : "–"}
            tone={totals.withMoney ? (totals.profit >= 0 ? "text-emerald-700" : "text-red-700") : undefined}
          />
        </div>
      ) : (
        history && (
          <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-neutral-600">
            {["Post your Reel", "Wait 2–3 days", "Enter the numbers here"].map((s, i) => (
              <li key={s} className="rounded-lg bg-white p-2 ring-1 ring-neutral-200">
                <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )
      )}

      <form onSubmit={submit} className="mt-5 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">New check-up</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Which Reel?</span>
          {reels ? (
            <select value={source} onChange={(e) => setSource(e.target.value)} className="h-12 rounded-lg border border-neutral-300 bg-white px-3">
              <option value="">Choose…</option>
              {reels.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.products?.name ?? "Reel"} · {languageLabel(r.language)} · {shortDate(r.created_at)}
                </option>
              ))}
              <option value="other">A Reel I made somewhere else</option>
            </select>
          ) : (
            <div className="h-12 animate-pulse rounded-lg bg-neutral-200" />
          )}
        </label>
        {source === "other" && products && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Product in that Reel</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-12 rounded-lg border border-neutral-300 bg-white px-3">
              <option value="">Choose a product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

        <fieldset>
          <legend className="text-sm font-medium">Your numbers</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-sm">{f.label}</span>
                <input
                  inputMode="numeric"
                  value={numbers[f.key]}
                  onChange={(e) => setNumbers((x) => ({ ...x, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  placeholder="0"
                  className="h-12 rounded-lg border border-neutral-300 bg-white px-3 tabular-nums"
                />
                <span className="text-[11px] leading-tight text-neutral-500">{f.hint}</span>
              </label>
            ))}
          </div>
          {warning && <p className="mt-2 text-sm text-red-700">{warning}</p>}
          <details className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Where do I find these?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600">
              <li><b>Views:</b> open the Reel on Instagram → <i>View insights</i> → <i>Views</i> (or <i>Plays</i>).</li>
              <li><b>DMs or link clicks:</b> count the chats that asked about this product, plus <i>Link clicks</i> in insights.</li>
              <li><b>Orders</b> and <b>returns:</b> from your order notebook or courier panel (Shiprocket → RTO).</li>
            </ul>
          </details>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">
            Money <span className="font-normal text-neutral-500">(optional)</span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Price you sold at (₹)</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={product ? String(product.selling_price_paise / 100) : "Market price"}
                className="h-12 rounded-lg border border-neutral-300 bg-white px-3 tabular-nums"
              />
              <span className="text-[11px] leading-tight text-neutral-500">
                {product ? `Blank = market price ${formatRupees(product.selling_price_paise)}` : "Blank = market price"}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">Spent on ads (₹)</span>
              <input
                inputMode="numeric"
                value={adSpend}
                onChange={(e) => setAdSpend(e.target.value.replace(/\D/g, "").slice(0, 7))}
                placeholder="0"
                className="h-12 rounded-lg border border-neutral-300 bg-white px-3 tabular-nums"
              />
              <span className="text-[11px] leading-tight text-neutral-500">Total boosting cost for this Reel</span>
            </label>
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="h-12 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-60" aria-live="polite">
          {busy ? WORKING[step] : "Check my Reel"}
        </button>
      </form>

      {result && (
        <section id="diagnosis" className="mt-6 scroll-mt-4" aria-live="polite">
          <h2 className="mb-2 font-semibold">{result.products?.name ?? "Your Reel"} · results</h2>
          <CheckupView c={result} previous={previousFor(result, history ?? [])} />
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Past check-ups</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {past.map((h) => {
              const d = h.diagnoses[0];
              const expanded = open === h.id;
              return (
                <li key={h.id} className="rounded-xl border border-neutral-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : h.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-start justify-between gap-2 p-3 text-left text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{h.products?.name ?? "Reel"}</span>
                      <span className="block text-xs text-neutral-500">
                        {shortDate(h.entered_at)} · {h.views.toLocaleString("en-IN")} views · {h.orders} orders
                        {d?.money && ` · ${d.money.profit_paise < 0 ? "−" : ""}${formatRupees(Math.abs(d.money.profit_paise))}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {d && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT[d.stage].tone}`}>{VERDICT[d.stage].short}</span>}
                      <span aria-hidden className="text-neutral-400">{expanded ? "▴" : "▾"}</span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-neutral-100 p-3">
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
          No Reels yet. <Link href="/reels/new" className="font-semibold underline">Make your first Reel →</Link>
        </p>
      )}
    </>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-neutral-200">
      <p className={`text-lg font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      {note && <p className="text-[10px] text-neutral-400">{note}</p>}
    </div>
  );
}
