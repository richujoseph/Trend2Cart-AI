"use client";

import Link from "next/link";
import { useState } from "react";
import { type Checkup, MESSAGE_TITLE, type Money, STAGE_LABEL, type StageKey, VERDICT, percent } from "@/lib/doctor";
import { formatRupees } from "@/lib/products";

/** The full result of one check-up: verdict, money, funnel, fixes, message and hooks. */
export default function CheckupView({ c, previous }: { c: Checkup; previous?: Checkup }) {
  const d = c.diagnoses[0];
  if (!d) return null;
  const v = VERDICT[d.stage];
  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-xl border p-4 ${v.banner}`}>
        <p className="text-lg font-bold">{v.title}</p>
        <p className="mt-1 text-sm">{d.explanation}</p>
      </div>
      {d.money && <MoneyCard money={d.money} returns={c.returns} />}
      <Funnel c={c} />
      {previous && <Progress now={c} before={previous} />}
      {d.fixes.length > 0 && <Fixes id={c.id} fixes={d.fixes} />}
      {d.message && <Message title={MESSAGE_TITLE[d.stage]} text={d.message} />}
      {d.new_hooks.length > 0 && <Hooks c={c} hooks={d.new_hooks} />}
    </div>
  );
}

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function MoneyCard({ money: m, returns }: { money: Money; returns: number }) {
  const gain = m.profit_paise >= 0;
  const rows: [string, number, string?][] = [
    [`Sales (${m.delivered} delivered × ${formatRupees(m.price_paise)})`, m.sales_paise],
    ["Product cost (supplier price)", -m.product_cost_paise],
    ["Shipping (courier rate card)", -m.shipping_paise, returns ? "incl. both ways for returns" : undefined],
    ["COD fees (courier rate card)", -m.cod_fees_paise],
  ];
  if (m.ad_spend_paise) rows.push(["Ads", -m.ad_spend_paise]);
  return (
    <Card title="What this Reel earned you">
      <p className={`mt-2 text-3xl font-bold tabular-nums ${gain ? "text-emerald-700" : "text-red-700"}`}>
        {gain ? "" : "−"}{formatRupees(Math.abs(m.profit_paise))}
      </p>
      <p className="text-sm text-neutral-600">{gain ? "profit" : "loss"} after product, shipping, COD fees{m.ad_spend_paise ? " and ads" : ""}</p>
      <dl className="mt-3 flex flex-col gap-1.5 border-t border-neutral-100 pt-3 text-sm">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-neutral-600">
              {label}
              {note && <span className="block text-xs text-neutral-400">{note}</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{value < 0 ? "−" : ""}{formatRupees(Math.abs(value))}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-xs text-neutral-500">Per delivered order</p>
          <p className={`font-semibold tabular-nums ${m.per_delivered_paise >= 0 ? "" : "text-red-700"}`}>
            {m.per_delivered_paise < 0 ? "−" : ""}{formatRupees(Math.abs(m.per_delivered_paise))}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-2">
          <p className="text-xs text-neutral-500">Lost to returns</p>
          <p className={`font-semibold tabular-nums ${m.returns_cost_paise ? "text-red-700" : ""}`}>
            {m.returns_cost_paise ? "−" : ""}{formatRupees(m.returns_cost_paise)}
          </p>
        </div>
      </div>
      {m.per_delivered_paise > 0 && m.ad_spend_paise > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Your ads pay for themselves at {Math.ceil(m.ad_spend_paise / m.per_delivered_paise)} delivered orders.
        </p>
      )}
    </Card>
  );
}

function Funnel({ c }: { c: Checkup }) {
  const rates = c.diagnoses[0].rates ?? {};
  const weak = c.diagnoses[0].stage;
  const steps: { label: string; count: number; stage?: StageKey }[] = [
    { label: "Views", count: c.views },
    { label: "DMs or clicks", count: c.clicks, stage: "interest" },
    { label: "Orders", count: c.orders, stage: "conversion" },
    { label: "Delivered", count: c.orders - c.returns, stage: "returns" },
  ];
  return (
    <Card title="Where buyers drop off">
      <ol className="mt-3 flex flex-col">
        {steps.map((step, i) => {
          const s = step.stage ? rates[step.stage] : undefined;
          const bad = step.stage === weak;
          const ok = s && (s.ratio === null || s.ratio >= 1);
          return (
            <li key={step.label}>
              {s && step.stage && (
                <div className="ml-3 flex flex-col gap-1 border-l-2 border-dashed border-neutral-200 py-2 pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bad ? "bg-amber-100 text-amber-900" : ok ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"}`}>
                      {bad ? "⚠ " : ok ? "✓ " : ""}{percent(s.rate)}
                    </span>
                    <span className="text-neutral-700">{STAGE_LABEL[step.stage]}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Estimate</span>
                    Usual: {s.lower_is_better ? "under " : "about "}{percent(s.benchmark)}
                    <span className="text-neutral-400">· {s.source}</span>
                  </p>
                </div>
              )}
              {step.stage && !s && i > 0 && (
                <p className="ml-3 border-l-2 border-dashed border-neutral-200 py-2 pl-4 text-xs text-neutral-400">Not enough numbers to judge this step yet.</p>
              )}
              <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <span className="text-sm font-medium">{step.label}</span>
                <span className="font-semibold tabular-nums">{step.count.toLocaleString("en-IN")}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Progress({ now, before }: { now: Checkup; before: Checkup }) {
  const a = now.diagnoses[0]?.rates ?? {};
  const b = before.diagnoses[0]?.rates ?? {};
  const rows = (Object.keys(STAGE_LABEL) as StageKey[]).filter((k) => a[k] && b[k]);
  const profitNow = now.diagnoses[0]?.money?.profit_paise;
  const profitBefore = before.diagnoses[0]?.money?.profit_paise;
  if (!rows.length) return null;
  return (
    <Card title="Since your last check-up">
      <p className="text-xs text-neutral-500">
        Compared with {new Date(before.entered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} for this product
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map((k) => {
          const diff = a[k]!.rate - b[k]!.rate;
          const better = k === "returns" ? diff < 0 : diff > 0;
          return (
            <li key={k} className="flex justify-between gap-2">
              <span className="text-neutral-600">{STAGE_LABEL[k]}</span>
              <span className="tabular-nums">
                {percent(b[k]!.rate)} → <b>{percent(a[k]!.rate)}</b>{" "}
                {Math.abs(diff) >= 0.0005 && <span className={better ? "text-emerald-700" : "text-red-700"}>{better ? "▲" : "▼"}</span>}
              </span>
            </li>
          );
        })}
        {profitNow !== undefined && profitBefore !== undefined && (
          <li className="flex justify-between gap-2 border-t border-neutral-100 pt-1.5">
            <span className="text-neutral-600">Profit</span>
            <span className="tabular-nums">
              {formatRupees(profitBefore)} → <b>{formatRupees(profitNow)}</b>
            </span>
          </li>
        )}
      </ul>
    </Card>
  );
}

function Fixes({ id, fixes }: { id: string; fixes: string[] }) {
  // Ticks are a personal to-do list, so they live in this browser only.
  const key = `doctor-done-${id}`;
  const [done, setDone] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      return [];
    }
  });
  function toggle(i: number) {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }
  return (
    <Card title="Try this week" aside={<span className="text-xs text-neutral-500">{done.length}/{fixes.length} done</span>}>
      <ul className="mt-2 flex flex-col gap-2">
        {fixes.map((f, i) => (
          <li key={f}>
            <label className="flex cursor-pointer gap-3 rounded-lg p-1 text-sm">
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} className="mt-0.5 h-5 w-5 shrink-0 accent-neutral-900" />
              <span className={done.includes(i) ? "text-neutral-400 line-through" : ""}>{f}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }, () => {})
      }
      className="h-9 shrink-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Card title="Ready-to-send message">
      <p className="text-xs text-neutral-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-neutral-900">{text}</p>
      <div className="mt-2 flex gap-2">
        <CopyButton text={text} />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white"
        >
          Send on WhatsApp
        </a>
      </div>
    </Card>
  );
}

function Hooks({ c, hooks }: { c: Checkup; hooks: string[] }) {
  return (
    <Card title="New opening lines to test">
      <p className="text-xs text-neutral-500">The first 2 seconds decide if people keep watching.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {hooks.map((h) => {
          const params = new URLSearchParams({ hook: h, ...(c.product_id && { product: c.product_id }), ...(c.language && { lang: c.language }) });
          return (
            <li key={h} className="rounded-lg bg-neutral-50 p-3 text-sm">
              <p className="font-medium">“{h}”</p>
              <div className="mt-2 flex gap-2">
                <CopyButton text={h} />
                <Link href={`/reels/new?${params}`} className="flex h-9 items-center rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white">
                  Make a Reel with this
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
