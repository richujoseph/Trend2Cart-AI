export type Language = "ml" | "hi" | "en";
export type ReelStatus = "queued" | "processing" | "done" | "failed";

export const LANGUAGES: { value: Language; label: string; native: string }[] = [
  { value: "ml", label: "Malayalam", native: "മലയാളം" },
  { value: "hi", label: "Hindi", native: "हिन्दी" },
  { value: "en", label: "English", native: "English" },
];

// Where the seller sells decides the default Reel language (they can still pick another for any Reel).
export const REGIONS: { value: string; label: string; language: Language }[] = [
  { value: "kerala", label: "Kerala", language: "ml" },
  { value: "tamil_nadu", label: "Tamil Nadu", language: "en" },
];

export const languageLabel = (l: string) => LANGUAGES.find((x) => x.value === l)?.label ?? l;

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
  profile: { plan: "free" | "pro" | "founding"; language: Language; region: string | null };
  reels: { limit: number | null; used: number; left: number | null; resets_at: string | null };
};

export const STATUS_LABEL: Record<ReelStatus, { text: string; tone: string }> = {
  queued: { text: "Waiting", tone: "bg-neutral-100 text-neutral-700" },
  processing: { text: "Making…", tone: "bg-amber-100 text-amber-800" },
  done: { text: "Ready", tone: "bg-emerald-100 text-emerald-800" },
  failed: { text: "Failed", tone: "bg-red-100 text-red-700" },
};

/** "2026-10-24T09:12:00+00:00" → "24 Oct" */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function reelsLeftText(me: Me): string {
  if (me.reels.limit === null) return "Unlimited Reels on your plan";
  const reset = me.reels.resets_at ? ` · resets ${shortDate(me.reels.resets_at)}` : "";
  return `${me.reels.left} of ${me.reels.limit} free Reels left this month${reset}`;
}
