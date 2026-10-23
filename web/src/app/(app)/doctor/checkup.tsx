"use client";

import Link from "next/link";
import { useState } from "react";
import { type Checkup, type Money, STAGES, type StageKey, VERDICT_TONE, percent, stageKey, verdictKey } from "@/lib/doctor";
import { fmt, useT } from "@/lib/i18n";
import { formatRupees } from "@/lib/products";
import { EstimateTag, btnSmall, card } from "@/components/ui";

/** The full result of one check-up: verdict, money, funnel, fixes, message and hooks. */
export default function CheckupView({ c, previous }: { c: Checkup; previous?: Checkup }) {
  const { t } = useT();
  const d = c.diagnoses[0];
  if (!d) return null;
  const tone = VERDICT_TONE[d.stage];
  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl bg-gradient-to-br ${tone.banner} p-4 text-white shadow-lg shadow-brand-900/10`}>
        <p className="text-lg font-extrabold">
          <span aria-hidden>{tone.icon} </span>
          {t.checkup[`title${verdictKey(d.stage)}`]}
        </p>
        <p className="mt-1 text-sm text-white/95">{d.explanation}</p>
      </div>
      {d.money && <MoneyCard money={d.money} returns={c.returns} />}
      <Funnel c={c} />
      {previous && <Progress now={c} before={previous} />}
      {d.fixes.length > 0 && <Fixes id={c.id} fixes={d.fixes} />}
      {d.message && <Message title={t.checkup[`msg${verdictKey(d.stage)}`]} text={d.message} />}
      {d.new_hooks.length > 0 && <Hooks c={c} hooks={d.new_hooks} />}
    </div>
  );
}

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-brand-900">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const signed = (paise: number) => `${paise < 0 ? "−" : ""}${formatRupees(Math.abs(paise))}`;

function MoneyCard({ money: m, returns }: { money: Money; returns: number }) {
  const { t } = useT();
  const gain = m.profit_paise >= 0;
  const rows: [string, number, string?][] = [
    [fmt(t.checkup.rowSales, { n: m.delivered, price: formatRupees(m.price_paise) }), m.sales_paise],
    [t.checkup.rowProduct, -m.product_cost_paise],
    [t.checkup.rowShipping, -m.shipping_paise, returns ? t.checkup.bothWays : undefined],
    [t.checkup.rowCod, -m.cod_fees_paise],
  ];
  if (m.ad_spend_paise) rows.push([t.checkup.rowAds, -m.ad_spend_paise]);
  return (
    <Card title={`💰 ${t.checkup.moneyTitle}`}>
      <p className={`mt-2 text-4xl font-extrabold tabular-nums ${gain ? "text-emerald-600" : "text-red-600"}`}>{signed(m.profit_paise)}</p>
      <p className="text-sm text-neutral-600">
        {gain ? t.common.profit : t.common.loss} {m.ad_spend_paise ? t.checkup.afterCostsAds : t.checkup.afterCosts}
      </p>
      <dl className="mt-3 flex flex-col gap-1.5 border-t border-brand-50 pt-3 text-sm">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-neutral-600">
              {label}
              {note && <span className="block text-xs text-neutral-400">{note}</span>}
            </dt>
            <dd className="shrink-0 tabular-nums">{signed(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-brand-50/70 p-2.5">
          <p className="text-xs text-neutral-500">{t.checkup.perDelivered}</p>
          <p className={`font-bold tabular-nums ${m.per_delivered_paise >= 0 ? "text-brand-900" : "text-red-700"}`}>{signed(m.per_delivered_paise)}</p>
        </div>
        <div className="rounded-xl bg-brand-50/70 p-2.5">
          <p className="text-xs text-neutral-500">{t.checkup.lostReturns}</p>
          <p className={`font-bold tabular-nums ${m.returns_cost_paise ? "text-red-700" : "text-brand-900"}`}>{signed(-m.returns_cost_paise)}</p>
        </div>
      </div>
      {m.per_delivered_paise > 0 && m.ad_spend_paise > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          {fmt(t.checkup.breakEven, { n: Math.ceil(m.ad_spend_paise / m.per_delivered_paise) })}
        </p>
      )}
    </Card>
  );
}

function Funnel({ c }: { c: Checkup }) {
  const { t } = useT();
  const rates = c.diagnoses[0].rates ?? {};
  const weak = c.diagnoses[0].stage;
  const steps: { label: string; count: number; stage?: StageKey }[] = [
    { label: t.checkup.stepViews, count: c.views },
    { label: t.checkup.stepClicks, count: c.clicks, stage: "interest" },
    { label: t.checkup.stepOrders, count: c.orders, stage: "conversion" },
    { label: t.checkup.stepDelivered, count: c.orders - c.returns, stage: "returns" },
  ];
  return (
    <Card title={`🔻 ${t.checkup.funnelTitle}`}>
      <ol className="mt-3 flex flex-col">
        {steps.map((step, i) => {
          const s = step.stage ? rates[step.stage] : undefined;
          const bad = step.stage === weak;
          const ok = s && (s.ratio === null || s.ratio >= 1);
          return (
            <li key={step.label}>
              {s && step.stage && (
                <div className="ml-4 flex flex-col gap-1 border-l-2 border-dashed border-brand-100 py-2 pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${bad ? "bg-amber-100 text-amber-900" : ok ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"}`}>
                      {bad ? "⚠ " : ok ? "✓ " : ""}{percent(s.rate)}
                    </span>
                    <span className="text-neutral-700">{t.checkup[`stage${stageKey(step.stage)}`]}</span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
                    <EstimateTag />
                    {fmt(s.lower_is_better ? t.checkup.usualUnder : t.checkup.usualAbout, { pct: percent(s.benchmark) })}
                    <span className="text-neutral-400">· {s.source}</span>
                  </p>
                </div>
              )}
              {step.stage && !s && i > 0 && (
                <p className="ml-4 border-l-2 border-dashed border-brand-100 py-2 pl-4 text-xs text-neutral-400">{t.checkup.notEnough}</p>
              )}
              <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${i === 0 ? "bg-brand-600 text-white" : "bg-brand-50"}`}>
                <span className="text-sm font-semibold">{step.label}</span>
                <span className="font-extrabold tabular-nums">{step.count.toLocaleString("en-IN")}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Progress({ now, before }: { now: Checkup; before: Checkup }) {
  const { t, date } = useT();
  const a = now.diagnoses[0]?.rates ?? {};
  const b = before.diagnoses[0]?.rates ?? {};
  const rows = STAGES.filter((k) => a[k] && b[k]);
  const profitNow = now.diagnoses[0]?.money?.profit_paise;
  const profitBefore = before.diagnoses[0]?.money?.profit_paise;
  if (!rows.length) return null;
  return (
    <Card title={`📊 ${t.checkup.sinceLast}`}>
      <p className="text-xs text-neutral-500">{fmt(t.checkup.comparedWith, { date: date(before.entered_at) })}</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map((k) => {
          const diff = a[k]!.rate - b[k]!.rate;
          const better = k === "returns" ? diff < 0 : diff > 0;
          return (
            <li key={k} className="flex justify-between gap-2">
              <span className="text-neutral-600">{t.checkup[`stage${stageKey(k)}`]}</span>
              <span className="shrink-0 tabular-nums">
                {percent(b[k]!.rate)} → <b>{percent(a[k]!.rate)}</b>{" "}
                {Math.abs(diff) >= 0.0005 && <span className={better ? "text-emerald-600" : "text-red-600"}>{better ? "▲" : "▼"}</span>}
              </span>
            </li>
          );
        })}
        {profitNow !== undefined && profitBefore !== undefined && (
          <li className="flex justify-between gap-2 border-t border-brand-50 pt-1.5">
            <span className="text-neutral-600">{t.checkup.profitRow}</span>
            <span className="tabular-nums">
              {signed(profitBefore)} → <b>{signed(profitNow)}</b>
            </span>
          </li>
        )}
      </ul>
    </Card>
  );
}

function Fixes({ id, fixes }: { id: string; fixes: string[] }) {
  const { t } = useT();
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
    <Card
      title={`✅ ${t.checkup.tryWeek}`}
      aside={<span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{fmt(t.checkup.done, { n: done.length, m: fixes.length })}</span>}
    >
      <ul className="mt-2 flex flex-col gap-1">
        {fixes.map((f, i) => (
          <li key={f}>
            <label className="flex cursor-pointer gap-3 rounded-xl p-2 text-sm transition hover:bg-brand-50/60">
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
              <span className={done.includes(i) ? "text-neutral-400 line-through" : ""}>{f}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useT();
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
      className={btnSmall}
    >
      {copied ? t.common.copied : t.common.copy}
    </button>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  const { t } = useT();
  return (
    <Card title={`💬 ${t.checkup.readyMessage}`}>
      <p className="text-xs text-neutral-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3 text-sm text-neutral-900 shadow-sm">{text}</p>
      <div className="mt-3 flex gap-2">
        <CopyButton text={text} />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-bold text-white"
        >
          {t.checkup.sendWhatsApp}
        </a>
      </div>
    </Card>
  );
}

function Hooks({ c, hooks }: { c: Checkup; hooks: string[] }) {
  const { t } = useT();
  return (
    <Card title={`🪝 ${t.checkup.hooksTitle}`}>
      <p className="text-xs text-neutral-500">{t.checkup.hooksSub}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {hooks.map((h) => {
          const params = new URLSearchParams({ hook: h, ...(c.product_id && { product: c.product_id }), ...(c.language && { lang: c.language }) });
          return (
            <li key={h} className="rounded-xl bg-brand-50/70 p-3 text-sm">
              <p className="font-semibold">“{h}”</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={h} />
                <Link href={`/reels/new?${params}`} className="flex h-9 items-center rounded-lg bg-gradient-to-r from-brand-600 to-fuchsia-600 px-3 text-sm font-bold text-white">
                  🎬 {t.checkup.makeWithThis}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
