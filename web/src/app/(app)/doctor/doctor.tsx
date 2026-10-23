"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { ProductListItem } from "@/lib/products";
import { type Reel, languageLabel, shortDate } from "@/lib/reels";
import { ErrorState } from "@/components/states";

type Stage = { rate: number; benchmark: number; source: string; ratio: number | null; lower_is_better?: boolean };
type Diagnosis = {
  result_id: string;
  product_name: string;
  stage: "interest" | "conversion" | "returns" | "healthy";
  summary: string;
  stages: Record<string, Stage>;
  explanation: string;
  fixes: string[];
  hooks: string[];
};
type HistoryItem = {
  id: string;
  views: number;
  clicks: number;
  orders: number;
  returns: number;
  entered_at: string;
  products: { name: string } | null;
  diagnoses: { stage: Diagnosis["stage"]; explanation: string }[];
};

const STAGE_TITLE: Record<Diagnosis["stage"], string> = {
  interest: "Weak spot: getting people interested",
  conversion: "Weak spot: turning chats into orders",
  returns: "Weak spot: orders coming back",
  healthy: "Looking healthy",
};
const STAGE_LABEL: Record<string, string> = {
  interest: "Viewers who DM'd or clicked",
  conversion: "Chats that became orders",
  returns: "Orders returned / refused",
};
const FIELDS = [
  { key: "views", label: "Views", hint: "From Instagram Insights on the Reel" },
  { key: "clicks", label: "DMs or link clicks", hint: "People who messaged you or tapped your link" },
  { key: "orders", label: "Orders", hint: "Confirmed orders from this Reel" },
  { key: "returns", label: "Returned or refused", hint: "COD orders that came back" },
] as const;
type Numbers = Record<(typeof FIELDS)[number]["key"], string>;

export default function Doctor() {
  const reelParam = useSearchParams().get("reel");
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [source, setSource] = useState(reelParam ?? "");
  const [productId, setProductId] = useState("");
  const [numbers, setNumbers] = useState<Numbers>({ views: "", clicks: "", orders: "", returns: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Diagnosis | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Reel[]>("/reels"),
      apiFetch<ProductListItem[]>("/products?sort=profit"),
      apiFetch<HistoryItem[]>("/doctor"),
    ])
      .then(([r, p, h]) => {
        setReels(r.filter((x) => x.status === "done"));
        setProducts(p);
        setHistory(h);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const values = Object.fromEntries(FIELDS.map((f) => [f.key, Number(numbers[f.key] || 0)]));
    if (Object.values(values).some((v) => !Number.isInteger(v) || v < 0)) {
      return setError("Use whole numbers only (0 or more).");
    }
    if (!source) return setError("Pick the Reel these numbers are for.");
    if (source === "other" && !productId) return setError("Pick the product this Reel was about.");
    setBusy(true);
    setError(null);
    try {
      const body = source === "other" ? { product_id: productId, ...values } : { reel_id: source, ...values };
      const d = await apiFetch<Diagnosis>("/doctor", { method: "POST", body: JSON.stringify(body) });
      setResult(d);
      apiFetch<HistoryItem[]>("/doctor").then(setHistory).catch(() => {});
      setTimeout(() => document.getElementById("diagnosis")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  return (
    <>
      <h1 className="text-xl font-bold">Conversion Doctor</h1>
      <p className="mt-1 text-sm text-neutral-600">Enter your Reel&apos;s numbers. We&apos;ll find where buyers drop off and how to fix it.</p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
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

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{f.label}</span>
              <input
                inputMode="numeric"
                value={numbers[f.key]}
                onChange={(e) => setNumbers((n) => ({ ...n, [f.key]: e.target.value.replace(/\D/g, "") }))}
                placeholder="0"
                className="h-12 rounded-lg border border-neutral-300 bg-white px-3 tabular-nums"
              />
              <span className="text-[11px] leading-tight text-neutral-500">{f.hint}</span>
            </label>
          ))}
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="h-12 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
          {busy ? "Checking your numbers…" : "Find my weak spot"}
        </button>
      </form>

      {result && <Result d={result} />}

      {history && history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Past check-ups</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{h.products?.name ?? "Reel"}</span>
                  <span className="text-xs text-neutral-500">{shortDate(h.entered_at)}</span>
                </div>
                <p className="text-xs text-neutral-500">
                  {h.views} views · {h.clicks} DMs/clicks · {h.orders} orders · {h.returns} returned
                </p>
                {h.diagnoses[0] && <p className="mt-1">{STAGE_TITLE[h.diagnoses[0].stage]}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Result({ d }: { d: Diagnosis }) {
  const [copied, setCopied] = useState<number | null>(null);
  const good = d.stage === "healthy";
  return (
    <section id="diagnosis" className="mt-6 flex flex-col gap-4" aria-live="polite">
      <div className={`rounded-xl p-4 ${good ? "bg-emerald-50" : "bg-amber-50"}`}>
        <p className={`text-lg font-bold ${good ? "text-emerald-800" : "text-amber-900"}`}>{STAGE_TITLE[d.stage]}</p>
        <p className="mt-1 text-sm">{d.explanation}</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold">Your funnel</h3>
        <ul className="mt-3 flex flex-col gap-4">
          {Object.entries(d.stages).map(([key, s]) => {
            const weak = key === d.stage;
            const scale = Math.max(s.rate, s.benchmark) || 1;
            return (
              <li key={key}>
                <div className="flex justify-between text-sm">
                  <span className={weak ? "font-semibold text-amber-900" : ""}>{weak ? "⚠ " : ""}{STAGE_LABEL[key]}</span>
                  <span className="tabular-nums">{(s.rate * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div className={`h-2 rounded-full ${weak ? "bg-amber-500" : "bg-neutral-700"}`} style={{ width: `${(s.rate / scale) * 100}%` }} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Estimate</span>
                  <span>
                    Usual: {s.lower_is_better ? "under " : "about "}{(s.benchmark * 100).toFixed(1)}% · Source: {s.source}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold">Try this week</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
          {d.fixes.map((f) => <li key={f}>{f}</li>)}
        </ol>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold">New hooks to test</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {d.hooks.map((h, i) => (
            <li key={h} className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 p-2 text-sm">
              <span>{h}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(h).then(() => setCopied(i), () => {})}
                className="shrink-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
              >
                {copied === i ? "Copied ✓" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/reels/new" className="mt-3 block text-sm font-semibold underline">Make a new Reel →</Link>
      </div>
    </section>
  );
}
