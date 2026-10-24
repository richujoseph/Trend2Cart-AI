"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CircleCheck, Clapperboard, Filter, LineChart, ListChecks, MessageCircle, Sparkles, TriangleAlert, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type Checkup, type Money, STAGES, type Stage, type StageKey, type Verdict, healthScore, percent, stageKey, verdictKey,
} from "@/lib/doctor";
import { fmt, useT } from "@/lib/i18n";
import { formatRupees, formatRupeesWhole } from "@/lib/products";
import { DataRow, EstimateTag, RibbonBackground, ScoreRing, btn, dataCard, glassCard } from "@/components/ui";

const signed = (paise: number) => `${paise < 0 ? "−" : ""}${formatRupees(Math.abs(paise))}`;
const signedWhole = (paise: number) => `${paise < 0 ? "−" : ""}${formatRupeesWhole(Math.abs(paise))}`;

/** The full report for one check-up: health, money, funnel, action plan, message and hooks. */
export default function CheckupView({ c, previous }: { c: Checkup; previous?: Checkup }) {
  const { t } = useT();
  const d = c.diagnoses[0];
  if (!d) return null;
  const health = healthScore(d.rates);
  return (
    <div className="flex flex-col gap-4">
      <div className={`${glassCard} relative isolate flex items-center gap-4 overflow-hidden p-5`}>
        <RibbonBackground variant="subtle" className="-z-10" />
        {health !== null && <ScoreRing value={health} size={80} label={t.doctor.healthLabel} />}
        <div className="min-w-0">
          <p className="text-xl font-black leading-snug text-ink">{t.checkup[`title${verdictKey(d.stage)}`]}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{d.explanation}</p>
        </div>
      </div>
      {d.money && <MoneyCard money={d.money} returns={c.returns} />}
      <section className={`${dataCard} p-5`}>
        <CardTitle icon={Filter} title={t.checkup.funnelTitle} onWhite />
        <FunnelView counts={c} rates={d.rates ?? {}} weak={d.stage} onWhite />
      </section>
      {previous && <Progress now={c} before={previous} />}
      {d.fixes.length > 0 && <Fixes id={c.id} fixes={d.fixes} />}
      {d.message && <Message title={t.checkup[`msg${verdictKey(d.stage)}`]} text={d.message} />}
      {d.new_hooks.length > 0 && <Hooks c={c} hooks={d.new_hooks} />}
    </div>
  );
}

function CardTitle({ title, icon: Icon, aside, onWhite = false }: { title: string; icon: LucideIcon; aside?: React.ReactNode; onWhite?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className={`flex items-center gap-2 text-xl font-black ${onWhite ? "text-charcoal" : "text-ink"}`}>
        <Icon className={`h-[18px] w-[18px] shrink-0 ${onWhite ? "text-rust-600" : "text-ember-400"}`} strokeWidth={1.5} aria-hidden /> {title}
      </h3>
      {aside}
    </div>
  );
}

/** Tapered funnel: views → DMs/clicks → orders → delivered, with each step's rate against the usual one. */
export function FunnelView({ counts, rates, weak, compact = false, onWhite = false }: {
  counts: { views: number; clicks: number; orders: number; returns: number };
  rates: Partial<Record<StageKey, Stage>>;
  weak: Verdict;
  compact?: boolean;
  onWhite?: boolean;
}) {
  const { t } = useT();
  const steps: { label: string; count: number; stage?: StageKey; width: number }[] = [
    { label: t.checkup.stepViews, count: counts.views, width: 100 },
    { label: t.checkup.stepClicks, count: counts.clicks, stage: "interest", width: 82 },
    { label: t.checkup.stepOrders, count: counts.orders, stage: "conversion", width: 64 },
    { label: t.checkup.stepDelivered, count: counts.orders - counts.returns, stage: "returns", width: 50 },
  ];
  const muted = onWhite ? "text-black/55" : "text-ink-2";
  return (
    <ol className="mt-4 flex flex-col items-center">
      {steps.map((step, i) => {
        const s = step.stage ? rates[step.stage] : undefined;
        const bad = step.stage === weak;
        const ok = s && (s.ratio === null || s.ratio >= 1);
        const chip = bad
          ? "bg-red text-white"
          : ok
            ? onWhite ? "text-profit-strong ring-1 ring-profit-strong/30" : "text-profit ring-1 ring-profit/30"
            : onWhite ? "text-black/70 ring-1 ring-black/15" : "text-ink-2 ring-1 ring-sage/40";
        const bar = bad
          ? "bg-red text-white"
          : i === 0
            ? onWhite ? "bg-charcoal text-white" : "bg-charcoal text-white"
            : onWhite ? "bg-card-muted text-charcoal" : "glass text-ink";
        return (
          <li key={step.label} className="flex w-full flex-col items-center">
            {i > 0 && (
              <div className="flex w-full flex-wrap items-center justify-center gap-2 py-2 text-[13px]">
                {s && step.stage ? (
                  <>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium tabular-nums ${chip}`}>
                      {bad ? <TriangleAlert className="h-3 w-3" strokeWidth={2} aria-hidden /> : ok ? <CircleCheck className="h-3 w-3" strokeWidth={2} aria-hidden /> : null}
                      {percent(s.rate)}
                    </span>
                    {!compact && (
                      <span className={muted}>
                        {fmt(s.lower_is_better ? t.checkup.usualUnder : t.checkup.usualAbout, { pct: percent(s.benchmark) })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={onWhite ? "text-black/40" : "text-ink-3"}>{t.checkup.notEnough}</span>
                )}
              </div>
            )}
            <div className={`flex min-h-11 items-center justify-between rounded-[16px] px-4 py-2 text-[15px] ${bar}`} style={{ width: `${step.width}%` }}>
              <span className="truncate">{step.label}</span>
              <span className="ml-2 font-medium tabular-nums">{step.count.toLocaleString("en-IN")}</span>
            </div>
          </li>
        );
      })}
      {!compact && (
        <li className={`mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs ${muted}`}>
          <EstimateTag onWhite={onWhite} /> {t.checkup.benchmarkNote}
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
    <section className={`${dataCard} p-5`}>
      <CardTitle icon={Wallet} title={t.checkup.moneyTitle} onWhite />
      <p className={`mt-3 text-[32px] font-medium leading-none tabular-nums ${gain ? "text-profit-strong" : "text-loss-strong"}`}>{signedWhole(m.profit_paise)}</p>
      <p className="mt-1.5 text-[13px] text-black/55">
        {gain ? t.common.profit : t.common.loss} {m.ad_spend_paise ? t.checkup.afterCostsAds : t.checkup.afterCosts}
      </p>
      <dl className="mt-4">
        {rows.map(([label, value, note]) => (
          <div key={label} className="border-t border-black/[0.08] py-2.5">
            <div className="flex justify-between gap-3 text-[15px]">
              <dt className="text-black/70">
                {label}
                {note && <span className="block text-xs text-black/45">{note}</span>}
              </dt>
              <dd className="shrink-0 tabular-nums text-black/85">{signed(value)}</dd>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-black/[0.06]">
              <div className={`h-1 rounded-full ${value >= 0 ? "bg-rust-500" : "bg-black/25"}`} style={{ width: `${Math.min(100, (Math.abs(value) / scale) * 100)}%` }} />
            </div>
          </div>
        ))}
      </dl>
      <DataRow label={t.checkup.perDelivered} value={signed(m.per_delivered_paise)} strong />
      <DataRow label={t.checkup.lostReturns} value={<span className={m.returns_cost_paise ? "text-loss-strong" : ""}>{signed(-m.returns_cost_paise)}</span>} />
      {m.per_delivered_paise > 0 && m.ad_spend_paise > 0 && (
        <p className="mt-2 text-[13px] text-black/55">{fmt(t.checkup.breakEven, { n: Math.ceil(m.ad_spend_paise / m.per_delivered_paise) })}</p>
      )}
    </section>
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
  const arrow = (better: boolean) => <span className={better ? "text-profit-strong" : "text-loss-strong"}>{better ? "▲" : "▼"}</span>;
  return (
    <section className={`${dataCard} p-5`}>
      <CardTitle icon={LineChart} title={t.checkup.sinceLast} onWhite />
      <p className="mb-3 mt-1 text-[13px] text-black/55">{fmt(t.checkup.comparedWith, { date: date(before.entered_at) })}</p>
      {healthNow !== null && healthBefore !== null && (
        <DataRow
          strong
          label={t.doctor.healthLabel}
          value={<>{healthBefore} → {healthNow} {healthNow !== healthBefore && arrow(healthNow > healthBefore)}</>}
        />
      )}
      {rows.map((k) => {
        const diff = a[k]!.rate - b[k]!.rate;
        const better = k === "returns" ? diff < 0 : diff > 0;
        return (
          <DataRow
            key={k}
            label={t.checkup[`stage${stageKey(k)}`]}
            value={<>{percent(b[k]!.rate)} → {percent(a[k]!.rate)} {Math.abs(diff) >= 0.0005 && arrow(better)}</>}
          />
        );
      })}
      {profitNow !== undefined && profitBefore !== undefined && (
        <DataRow label={t.checkup.profitRow} value={<>{signedWhole(profitBefore)} → {signedWhole(profitNow)}</>} strong />
      )}
    </section>
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
    <section className={`${glassCard} p-5`}>
      <CardTitle
        icon={ListChecks}
        title={t.checkup.tryWeek}
        aside={<span className="text-[13px] font-medium tabular-nums text-ember-300">{fmt(t.checkup.done, { n: done.length, m: fixes.length })}</span>}
      />
      <div className="mt-3 h-1 rounded-full bg-sage/20">
        <div className="h-1 rounded-full bg-ember-400 transition-all" style={{ width: `${(done.length / fixes.length) * 100}%` }} />
      </div>
      <ul className="mt-3 flex flex-col">
        {fixes.map((f, i) => (
          <li key={f} className="border-t border-sage/30 first:border-0">
            <label className="flex min-h-11 cursor-pointer gap-3 py-3 text-[15px] leading-relaxed">
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} className="mt-1 h-5 w-5 shrink-0 accent-ember-400" />
              <span className={done.includes(i) ? "text-ink-3 line-through" : "text-ink"}>
                <span className="mr-1 text-[13px] font-medium text-ember-300">{i === 0 ? t.checkup.first : `${i + 1}.`}</span>
                {f}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
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
      className={`${btn.glass} min-h-11 px-4 text-sm`}
    >
      {copied ? t.common.copied : t.common.copy}
    </button>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  const { t } = useT();
  return (
    <section className={`${glassCard} p-5`}>
      <CardTitle icon={MessageCircle} title={t.checkup.readyMessage} />
      <p className="mt-1 text-[13px] text-ink-2">{title}</p>
      <p className="mt-3 whitespace-pre-wrap rounded-[16px] rounded-tl-sm bg-card-muted p-4 text-[15px] leading-relaxed text-ink">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton text={text} />
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={`${btn.light} min-h-11 px-5 text-sm`}>
          {t.checkup.sendWhatsApp}
        </a>
      </div>
    </section>
  );
}

function Hooks({ c, hooks }: { c: Checkup; hooks: string[] }) {
  const { t } = useT();
  return (
    <section className={`${glassCard} p-5`}>
      <CardTitle icon={Sparkles} title={t.checkup.hooksTitle} />
      <p className="mt-1 text-[13px] text-ink-2">{t.checkup.hooksSub}</p>
      <ul className="mt-3 flex flex-col">
        {hooks.map((h) => {
          const params = new URLSearchParams({ hook: h, ...(c.product_id && { product: c.product_id }), ...(c.language && { lang: c.language }) });
          return (
            <li key={h} className="border-t border-sage/30 py-4 first:border-0 first:pt-2">
              <p className="text-[17px] font-black leading-snug text-ink">“{h}”</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={h} />
                <Link href={`/reels/new?${params}`} className={`${btn.light} min-h-11 px-4 text-sm`}>
                  <Clapperboard className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {t.checkup.makeWithThis}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
