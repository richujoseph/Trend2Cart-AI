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

export const VERDICT: Record<Verdict, { title: string; short: string; tone: string; banner: string }> = {
  interest: {
    title: "Weak spot: getting people interested",
    short: "Interest is low",
    tone: "bg-amber-100 text-amber-900",
    banner: "border-amber-200 bg-amber-50 text-amber-950",
  },
  conversion: {
    title: "Weak spot: turning chats into orders",
    short: "Chats not converting",
    tone: "bg-amber-100 text-amber-900",
    banner: "border-amber-200 bg-amber-50 text-amber-950",
  },
  returns: {
    title: "Weak spot: orders coming back",
    short: "Too many returns",
    tone: "bg-red-100 text-red-800",
    banner: "border-red-200 bg-red-50 text-red-950",
  },
  healthy: {
    title: "Looking healthy",
    short: "Healthy",
    tone: "bg-emerald-100 text-emerald-800",
    banner: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
};

export const STAGE_LABEL: Record<StageKey, string> = {
  interest: "Viewers who DM'd or clicked",
  conversion: "Chats that became orders",
  returns: "Orders returned or refused",
};

// What the ready-to-send message is for, per verdict (mirrors MESSAGES in api/core/doctor.py).
export const MESSAGE_TITLE: Record<Verdict, string> = {
  interest: "Caption for your next Reel",
  conversion: "Reply when someone asks the price",
  returns: "Confirm each COD order before shipping",
  healthy: "Ask happy buyers for a photo or review",
};

export const percent = (rate: number) => `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;
