import type { Language } from "@/lib/reels";

export type StageKey = "interest" | "conversion" | "returns";
export type Verdict = StageKey | "healthy";

export type Stage = { rate: number; benchmark: number; source: string; ratio: number | null; lower_is_better?: boolean };

/** All paise. Snapshot saved with each check-up (null on check-ups from before money was added). */
export type Money = {
  delivered: number;
  sales_paise: number;
  product_cost_paise: number;
  shipping_paise: number;
  cod_fees_paise: number;
  ad_spend_paise: number;
  returns_cost_paise: number;
  per_delivered_paise: number;
  price_paise: number;
  profit_paise: number;
};

export type Diagnosis = {
  stage: Verdict;
  explanation: string;
  fixes: string[];
  new_hooks: string[];
  rates: Partial<Record<StageKey, Stage>> | null;
  message: string | null;
  money: Money | null;
};

/** One check-up: POST /doctor returns this shape, GET /doctor a list of them. */
export type Checkup = {
  id: string;
  reel_id: string | null;
  product_id: string | null;
  views: number;
  clicks: number;
  orders: number;
  returns: number;
  language: Language | null;
  entered_at: string;
  products: { name: string } | null;
  diagnoses: Diagnosis[];
};

// Text is in the i18n dictionary (t.checkup.title*/short*/stage*/msg*).
export const VERDICT_TONE: Record<Verdict, { tone: string; banner: string; dot: string }> = {
  interest: { tone: "bg-amber-400/15 text-amber-300", banner: "from-[#5a1a0c] via-[#a3360f] to-[#e07a2c]", dot: "bg-amber-400" },
  conversion: { tone: "bg-orange-400/15 text-orange-300", banner: "from-[#5a130c] via-[#a82a16] to-[#ef6a3c]", dot: "bg-orange-400" },
  returns: { tone: "bg-red-500/15 text-red-300", banner: "from-[#3f0808] via-[#8f1414] to-[#d6331f]", dot: "bg-red-500" },
  healthy: { tone: "bg-emerald-400/15 text-emerald-300", banner: "from-[#06281c] via-[#0b5a3c] to-[#16a06a]", dot: "bg-emerald-400" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "interest" → "Interest", for t.checkup[`title${key}`] style lookups. */
export const verdictKey = (v: Verdict) => cap(v) as "Interest" | "Conversion" | "Returns" | "Healthy";
export const stageKey = (s: StageKey) => cap(s) as "Interest" | "Conversion" | "Returns";
export const STAGES: StageKey[] = ["interest", "conversion", "returns"];

export const percent = (rate: number) => `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;

export type Benchmarks = {
  interest: { rate: number; source: string };
  conversion: { rate: number; source: string };
  returns_by_category: Record<string, number>;
  returns_default: number;
};

/** One stage vs its usual rate → 0–100 (at or above usual ≈ 80, a quarter better or more = 100). */
export function stageScore(s: Stage): number {
  if (s.ratio === null) return 100; // no returns at all
  return Math.round((Math.min(s.ratio, 1.25) / 1.25) * 100);
}

/** Average of the judged stages; null when nothing could be judged. */
export function healthScore(rates: Partial<Record<StageKey, Stage>> | null | undefined): number | null {
  const stages = Object.values(rates ?? {}) as Stage[];
  if (!stages.length) return null;
  return Math.round(stages.reduce((sum, s) => sum + stageScore(s), 0) / stages.length);
}

/** Same rules as api/core/doctor.py diagnose(), so the preview matches the final result. */
export function previewRates(
  n: { views: number; clicks: number; orders: number; returns: number },
  b: Benchmarks,
  category: string | undefined,
): Partial<Record<StageKey, Stage>> {
  if (n.views <= 0 || n.clicks > n.views || n.returns > n.orders) return {};
  const rto = (category ? b.returns_by_category[category] : undefined) ?? b.returns_default;
  const out: Partial<Record<StageKey, Stage>> = {};
  const make = (rate: number, benchmark: number, source: string, lower = false): Stage => ({
    rate, benchmark, source, lower_is_better: lower,
    ratio: lower ? (rate > 0 ? benchmark / rate : null) : rate / benchmark,
  });
  out.interest = make(n.clicks / n.views, b.interest.rate, b.interest.source);
  if (n.clicks > 0) out.conversion = make(n.orders / n.clicks, b.conversion.rate, b.conversion.source);
  if (n.orders > 0) out.returns = make(n.returns / n.orders, rto, "", true);
  return out;
}

/** The weakest stage below its usual rate, or "healthy". */
export function weakest(rates: Partial<Record<StageKey, Stage>>): Verdict {
  let worst: StageKey | null = null;
  for (const k of STAGES) {
    const s = rates[k];
    if (!s || s.ratio === null || s.ratio >= 1) continue;
    if (!worst || s.ratio < (rates[worst]!.ratio as number)) worst = k;
  }
  return worst ?? "healthy";
}
