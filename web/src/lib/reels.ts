export type Language = "ml" | "hi" | "en";
export type ReelStatus = "queued" | "processing" | "done" | "failed";

export const LANGUAGES: { value: Language; label: string; native: string }[] = [
  { value: "ml", label: "Malayalam", native: "മലയാളം" },
  { value: "hi", label: "Hindi", native: "हिन्दी" },
  { value: "en", label: "English", native: "English" },
];

// Where the seller sells decides the default Reel language (they can still pick another for any Reel).
export const REGIONS: { value: "kerala" | "tamil_nadu"; language: Language }[] = [
  { value: "kerala", language: "ml" },
  { value: "tamil_nadu", language: "en" },
];

export const languageLabel = (l: string) => LANGUAGES.find((x) => x.value === l)?.native ?? l;

// Mirrors api/core/reels/templates.py so the picker previews the real look.
export const TEMPLATES = [
  { id: 1, name: "Bold Night", bg: "#111111", accent: "#FFD60A", text: "#FFFFFF" },
  { id: 2, name: "Pop Card", bg: "#FF5C8A", accent: "#111111", text: "#111111" },
  { id: 3, name: "Fresh Split", bg: "#0F766E", accent: "#F97316", text: "#FFFFFF" },
] as const;

export type Reel = {
  id: string;
  status: ReelStatus;
  stage?: "script" | "voice" | "video" | null; // worker's current step while processing
  error: string | null;
  video_url: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  language: Language;
  template_id: number;
  product_id: string;
  audience: string | null;
  photo_paths?: string[];
  requested_hook?: string | null;
  created_at: string;
  products: { name: string } | null;
};

export type Me = {
  email: string | null;
  phone: string | null;
  profile: {
    plan: "free" | "pro" | "founding";
    language: Language;
    region: string | null;
    display_name?: string | null;
    business_name?: string | null;
    whatsapp?: string | null;
    city?: string | null;
  };
  reels: { limit: number | null; used: number; left: number | null; resets_at: string | null };
};

export const STATUS_TONE: Record<ReelStatus, { key: "statusQueued" | "statusProcessing" | "statusDone" | "statusFailed"; tone: string }> = {
  queued: { key: "statusQueued", tone: "bg-white/10 text-ink-2" },
  processing: { key: "statusProcessing", tone: "bg-charcoal/10 text-charcoal" },
  done: { key: "statusDone", tone: "bg-profit/15 text-profit" },
  failed: { key: "statusFailed", tone: "bg-loss/15 text-loss" },
};
