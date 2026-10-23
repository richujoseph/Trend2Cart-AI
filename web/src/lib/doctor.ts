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
export const VERDICT_TONE: Record<Verdict, { tone: string; banner: string; icon: string }> = {
  interest: { tone: "bg-amber-100 text-amber-900", banner: "from-amber-400 to-orange-500", icon: "👀" },
  conversion: { tone: "bg-amber-100 text-amber-900", banner: "from-orange-400 to-rose-500", icon: "💬" },
  returns: { tone: "bg-red-100 text-red-800", banner: "from-rose-500 to-red-600", icon: "📦" },
  healthy: { tone: "bg-emerald-100 text-emerald-800", banner: "from-emerald-500 to-teal-600", icon: "🎉" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "interest" → "Interest", for t.checkup[`title${key}`] style lookups. */
export const verdictKey = (v: Verdict) => cap(v) as "Interest" | "Conversion" | "Returns" | "Healthy";
export const stageKey = (s: StageKey) => cap(s) as "Interest" | "Conversion" | "Returns";
export const STAGES: StageKey[] = ["interest", "conversion", "returns"];

export const percent = (rate: number) => `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;
