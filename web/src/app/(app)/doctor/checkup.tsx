"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CircleCheck, Clapperboard, Filter, LineChart, ListChecks, MessageCircle, Sparkles, TriangleAlert, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type Checkup, type Money, STAGES, type Stage, type StageKey, VERDICT_TONE, type Verdict, healthScore, percent,
  stageKey, verdictKey,
} from "@/lib/doctor";
import { fmt, useT } from "@/lib/i18n";
import { formatRupees } from "@/lib/products";
import { EstimateTag, ScoreRing, btnSmall, card } from "@/components/ui";

const signed = (paise: number) => `${paise < 0 ? "−" : ""}${formatRupees(Math.abs(paise))}`;

/** The full report for one check-up: health, money, funnel, action plan, message and hooks. */
export default function CheckupView({ c, previous }: { c: Checkup; previous?: Checkup }) {
  const { t } = useT();
  const d = c.diagnoses[0];
  if (!d) return null;
  const tone = VERDICT_TONE[d.stage];
  const health = healthScore(d.rates);
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-4 rounded-2xl bg-gradient-to-br ${tone.banner} p-4 text-white shadow-lg shadow-black/40`}>
        {health !== null && <ScoreRing value={health} size={84} label={t.doctor.healthLabel} light />}
        <div className="min-w-0">
          <p className="text-lg font-medium leading-tight">{t.checkup[`title${verdictKey(d.stage)}`]}</p>
          <p className="mt-1 text-sm text-white/95">{d.explanation}</p>
        </div>
      </div>
      {d.money && <MoneyCard money={d.money} returns={c.returns} />}
      <Card icon={Filter} title={t.checkup.funnelTitle}>
        <FunnelView counts={c} rates={d.rates ?? {}} weak={d.stage} />
      </Card>
      {previous && <Progress now={c} before={previous} />}
      {d.fixes.length > 0 && <Fixes id={c.id} fixes={d.fixes} />}
      {d.message && <Message title={t.checkup[`msg${verdictKey(d.stage)}`]} text={d.message} />}
      {d.new_hooks.length > 0 && <Hooks c={c} hooks={d.new_hooks} />}
    </div>
  );
}

function Card({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-normal text-ink">
          <Icon className="h-5 w-5 shrink-0 text-brand-500" aria-hidden /> {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Tapered funnel: views → DMs/clicks → orders → delivered, with each step's rate against the usual one. */
export function FunnelView({ counts, rates, weak, compact = false }: {
  counts: { views: number; clicks: number; orders: number; returns: number };
  rates: Partial<Record<StageKey, Stage>>;
  weak: Verdict;
  compact?: boolean;
}) {
  const { t } = useT();
  const steps: { label: string; count: number; stage?: StageKey; width: number }[] = [
    { label: t.checkup.stepViews, count: counts.views, width: 100 },
    { label: t.checkup.stepClicks, count: counts.clicks, stage: "interest", width: 82 },
    { label: t.checkup.stepOrders, count: counts.orders, stage: "conversion", width: 64 },
    { label: t.checkup.stepDelivered, count: counts.orders - counts.returns, stage: "returns", width: 50 },
  ];
  return (
    <ol className="mt-3 flex flex-col items-center">
      {steps.map((step, i) => {
        const s = step.stage ? rates[step.stage] : undefined;
        const bad = step.stage === weak;
        const ok = s && (s.ratio === null || s.ratio >= 1);
        return (
          <li key={step.label} className="flex w-full flex-col items-center">
            {i > 0 && (
              <div className="flex w-full items-center justify-center gap-2 py-1.5 text-xs">
                {s && step.stage ? (
                  <>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${bad ? "bg-amber-400/15 text-amber-200" : ok ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-ink/85"}`}>
                      {bad ? <TriangleAlert className="h-3 w-3" aria-hidden /> : ok ? <CircleCheck className="h-3 w-3" aria-hidden /> : null}
                      {percent(s.rate)}
                    </span>
                    {!compact && (
                      <span className="text-ink-2">
                        {fmt(s.lower_is_better ? t.checkup.usualUnder : t.checkup.usualAbout, { pct: percent(s.benchmark) })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-3">{t.checkup.notEnough}</span>
                )}
              </div>
            )}
            <div
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${bad ? "bg-gradient-to-r from-amber-400 to-orange-400 text-white" : i === 0 ? "bg-gradient-to-r from-[#b8321a] to-brand-600 text-white" : "bg-brand-50 text-brand-900"}`}
              style={{ width: `${step.width}%` }}
            >
              <span className="truncate font-semibold">{step.label}</span>
              <span className="ml-2 font-medium tabular-nums">{step.count.toLocaleString("en-IN")}</span>
            </div>
          </li>
        );
      })}
      {!compact && (
        <li className="mt-3 flex flex-wrap items-center justify-center gap-1 text-[11px] text-ink-2">
          <EstimateTag /> {t.checkup.benchmarkNote}
        </li>
      )}
    </ol>
  );
}

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
  const scale = Math.max(m.sales_paise, 1);
  return (
    <Card icon={Wallet} title={t.checkup.moneyTitle}>
      <p className={`mt-2 text-4xl font-medium tabular-nums ${gain ? "text-emerald-400" : "text-red-400"}`}>{signed(m.profit_paise)}</p>
      <p className="text-sm text-ink-2">
        {gain ? t.common.profit : t.common.loss} {m.ad_spend_paise ? t.checkup.afterCostsAds : t.checkup.afterCosts}
      </p>
      <dl className="mt-3 flex flex-col gap-2 border-t border-white/[0.07] pt-3 text-sm">
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">
                {label}
                {note && <span className="block text-xs text-ink-3">{note}</span>}
              </dt>
              <dd className="shrink-0 tabular-nums">{signed(value)}</dd>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-brand-50">
              <div className={`h-1.5 rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-rose-300"}`} style={{ width: `${Math.min(100, (Math.abs(value) / scale) * 100)}%` }} />
            </div>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-brand-50/70 p-2.5">
          <p className="text-xs text-ink-2">{t.checkup.perDelivered}</p>
          <p className={`font-bold tabular-nums ${m.per_delivered_paise >= 0 ? "text-brand-900" : "text-red-400"}`}>{signed(m.per_delivered_paise)}</p>
        </div>
        <div className="rounded-xl bg-brand-50/70 p-2.5">
          <p className="text-xs text-ink-2">{t.checkup.lostReturns}</p>
          <p className={`font-bold tabular-nums ${m.returns_cost_paise ? "text-red-400" : "text-brand-900"}`}>{signed(-m.returns_cost_paise)}</p>
        </div>
      </div>
      {m.per_delivered_paise > 0 && m.ad_spend_paise > 0 && (
        <p className="mt-2 text-xs text-ink-2">{fmt(t.checkup.breakEven, { n: Math.ceil(m.ad_spend_paise / m.per_delivered_paise) })}</p>
      )}
    </Card>
  );
}

function Progress({ now, before }: { now: Checkup; before: Checkup }) {
  const { t, date } = useT();
  const a = now.diagnoses[0]?.rates ?? {};
  const b = before.diagnoses[0]?.rates ?? {};
  const rows = STAGES.filter((k) => a[k] && b[k]);
  const healthNow = healthScore(a);
  const healthBefore = healthScore(b);
  const profitNow = now.diagnoses[0]?.money?.profit_paise;
  const profitBefore = before.diagnoses[0]?.money?.profit_paise;
  if (!rows.length) return null;
  return (
    <Card icon={LineChart} title={t.checkup.sinceLast}>
      <p className="text-xs text-ink-2">{fmt(t.checkup.comparedWith, { date: date(before.entered_at) })}</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {healthNow !== null && healthBefore !== null && (
          <li className="flex justify-between gap-2 font-semibold">
            <span>{t.doctor.healthLabel}</span>
            <span className="tabular-nums">
              {healthBefore} → <b>{healthNow}</b>{" "}
              {healthNow !== healthBefore && <span className={healthNow > healthBefore ? "text-emerald-400" : "text-red-400"}>{healthNow > healthBefore ? "▲" : "▼"}</span>}
            </span>
          </li>
        )}
        {rows.map((k) => {
          const diff = a[k]!.rate - b[k]!.rate;
          const better = k === "returns" ? diff < 0 : diff > 0;
          return (
            <li key={k} className="flex justify-between gap-2">
              <span className="text-ink-2">{t.checkup[`stage${stageKey(k)}`]}</span>
              <span className="shrink-0 tabular-nums">
                {percent(b[k]!.rate)} → <b>{percent(a[k]!.rate)}</b>{" "}
                {Math.abs(diff) >= 0.0005 && <span className={better ? "text-emerald-400" : "text-red-400"}>{better ? "▲" : "▼"}</span>}
              </span>
            </li>
          );
        })}
        {profitNow !== undefined && profitBefore !== undefined && (
          <li className="flex justify-between gap-2 border-t border-white/[0.07] pt-1.5">
            <span className="text-ink-2">{t.checkup.profitRow}</span>
            <span className="tabular-nums">{signed(profitBefore)} → <b>{signed(profitNow)}</b></span>
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
      icon={ListChecks}
      title={t.checkup.tryWeek}
      aside={<span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-400">{fmt(t.checkup.done, { n: done.length, m: fixes.length })}</span>}
    >
      <div className="mt-2 h-1.5 rounded-full bg-brand-50">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#b8321a] to-emerald-500 transition-all" style={{ width: `${(done.length / fixes.length) * 100}%` }} />
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {fixes.map((f, i) => (
          <li key={f}>
            <label className="flex cursor-pointer gap-3 rounded-xl p-2 text-sm transition hover:bg-brand-50/60">
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
              <span className={done.includes(i) ? "text-ink-3 line-through" : ""}>
                <span className="mr-1 text-xs font-bold text-brand-400">{i === 0 ? t.checkup.first : `${i + 1}.`}</span>
                {f}
              </span>
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
    <Card icon={MessageCircle} title={t.checkup.readyMessage}>
      <p className="text-xs text-ink-2">{title}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#16382a] p-3 text-sm text-ink shadow-sm">{text}</p>
      <div className="mt-3 flex gap-2">
        <CopyButton text={text} />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center rounded-lg bg-[#25D366] px-3 text-sm font-bold text-white"
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
    <Card icon={Sparkles} title={t.checkup.hooksTitle}>
      <p className="text-xs text-ink-2">{t.checkup.hooksSub}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {hooks.map((h) => {
          const params = new URLSearchParams({ hook: h, ...(c.product_id && { product: c.product_id }), ...(c.language && { lang: c.language }) });
          return (
            <li key={h} className="rounded-xl bg-brand-50/70 p-3 text-sm">
              <p className="font-semibold">“{h}”</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={h} />
                <Link href={`/reels/new?${params}`} className="flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-orange-600 px-3 text-sm font-bold text-white">
                  <Clapperboard className="h-4 w-4" aria-hidden /> {t.checkup.makeWithThis}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
