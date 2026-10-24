"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { type Lang, useT } from "@/lib/i18n";
import { useLanguage } from "@/lib/profile";
import type { Me } from "@/lib/reels";

// "Sophisticated playful" system: off-white base, charcoal (never pure black), red ONLY for actions and
// critical alerts, sage borders, white 40px cards with a large soft shadow, nested items at 24px.
const SHADOW = "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]";
export const card = `rounded-[40px] bg-white ring-1 ring-sage/30 ${SHADOW}`;
export const glassCard = `glass rounded-[40px] ${SHADOW}`;
export const dataCard = `rounded-[40px] bg-white text-charcoal ring-1 ring-sage/30 ${SHADOW}`;
export const cardLight = dataCard;
/** Nested / small item (24px), per the spec's radius scale. */
export const tile = "rounded-[24px] bg-white ring-1 ring-sage/30";

/** Pills: light = primary action (red), dark = charcoal, glass = white with sage border, ghost = text. */
export const btn = {
  light:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-red px-6 py-2 text-center text-[15px] font-extrabold leading-tight text-white shadow-[0_12px_28px_-10px_rgba(202,0,19,0.45)] transition hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:shadow-none",
  dark:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-charcoal px-6 py-2 text-center text-[15px] font-extrabold leading-tight text-white transition hover:bg-black/90 active:scale-[.98] disabled:opacity-40",
  glass:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-sage/60 bg-white px-6 py-2 text-center text-[15px] font-bold leading-tight text-charcoal transition hover:border-charcoal active:scale-[.98] disabled:opacity-40",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] font-bold text-ink-2 transition hover:text-charcoal disabled:opacity-40",
};
export const btnPrimary = btn.light;
export const btnAccent = btn.light;
export const btnSecondary = btn.glass;
export const btnSmall =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-sage/60 bg-white px-4 text-sm font-bold text-charcoal hover:border-charcoal";
export const input =
  "h-12 w-full rounded-[16px] border border-sage/50 bg-white px-4 text-[15px] font-semibold text-charcoal outline-none transition placeholder:font-normal placeholder:text-ink-3 focus:border-charcoal";
export const glassInput = input;
export const chip = (active: boolean) =>
  `h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${
    active ? "bg-charcoal text-white" : "border border-sage/40 bg-white text-ink-2 hover:text-charcoal"
  }`;

/** Soft sage blobs used as decoration where the old theme had ribbons. */
export function RibbonBackground({ variant = "section", className = "" }: { variant?: "hero" | "section" | "subtle"; className?: string }) {
  const scale = { hero: 1, section: 0.85, subtle: 0.65 }[variant];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute -right-16 -top-20 rounded-full bg-sage/25 animate-drift"
        style={{ width: 260 * scale, height: 260 * scale, borderRadius: "58% 42% 55% 45% / 48% 60% 40% 52%" }}
      />
      <div className="absolute -left-10 top-24 rounded-full bg-sage/15" style={{ width: 140 * scale, height: 140 * scale }} />
    </div>
  );
}
/** Same decoration for wide marketing sections. */
export function Ribbons({ className = "" }: { className?: string; seed?: number }) {
  return <RibbonBackground variant="hero" className={className} />;
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="relative inline-flex shrink-0 items-center justify-center rounded-[30%] bg-charcoal"
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%] text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6.2" />
        <path d="M11 9.5l2 2 3.5-4" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-[28%] w-[28%] rounded-full border-2 border-offwhite bg-red" />
    </span>
  );
}

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "ml", label: "മലയാളം" },
  { value: "hi", label: "हिन्दी" },
  { value: "en", label: "English" },
];

/** Compact language switcher; saves to the profile when signed in. */
export function LanguageSelect() {
  const { t } = useT();
  const { lang, setLanguage, error } = useLanguage();
  return (
    <span className="relative inline-flex flex-col items-end">
      <label className="relative inline-flex items-center">
        <span className="sr-only">{t.common.language}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 h-4 w-4 text-ink-3" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
        <select
          value={lang}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className="h-11 appearance-none rounded-full border border-sage/50 bg-white pl-9 pr-4 text-sm font-bold text-charcoal outline-none"
        >
          {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {error && <span role="alert" className="absolute top-12 z-30 w-48 rounded-[16px] bg-white p-2 text-xs font-semibold text-red shadow-lg ring-1 ring-red/30">{error}</span>}
    </span>
  );
}

const noop = () => () => {};

/** App header: greeting label + seller name on the left; language and a 48px profile circle on the right. */
export function TopBar() {
  const { t } = useT();
  const [me, setMe] = useState<Me | null>(null);
  // The clock is read in the browser only (prerendering can't depend on the time of day).
  const hour = useSyncExternalStore(noop, () => new Date().getHours(), () => null);
  useEffect(() => {
    const load = () => apiFetch<Me>("/me").then(setMe).catch(() => {});
    load();
    window.addEventListener("t2c-profile", load); // name edited in Account
    return () => window.removeEventListener("t2c-profile", load);
  }, []);
  const name = me?.profile.display_name || (me?.email ? me.email.split("@")[0].replace(/[._-]+/g, " ") : me?.phone ? `+${me.phone.slice(-4).padStart(me.phone.length, "•")}` : "");
  const greeting = hour === null ? "\u00a0" : hour < 12 ? t.common.greetMorning : hour < 17 ? t.common.greetAfternoon : t.common.greetEvening;
  return (
    <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-6xl lg:px-10 lg:pt-7">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{greeting}</p>
          <p className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold capitalize leading-tight tracking-tight text-charcoal lg:text-3xl">{name || "Trend2Cart"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="lg:hidden"><LanguageSelect /></span>
          <Link href="/account" aria-label={t.nav.account} className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-charcoal text-lg font-black uppercase text-white shadow-md">
              {(name || "T").charAt(0)}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Page header: white 40px card with a sage blob, 32px black-weight title. */
export function PageHero({ title, subtitle, children, icon: Icon }: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  seed?: number;
  tone?: string;
}) {
  return (
    <section className={`${card} relative isolate overflow-hidden p-6`}>
      <RibbonBackground variant="subtle" className="-z-10" />
      {Icon && (
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white shadow-md ring-1 ring-sage/30">
          <Icon className="h-7 w-7 text-charcoal" strokeWidth={2} aria-hidden />
        </span>
      )}
      <h1 className="text-[32px] font-black leading-[1.1] text-charcoal lg:text-5xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink-2 lg:max-w-[52ch] lg:text-base">{subtitle}</p>}
      {children}
    </section>
  );
}

export function SectionTitle({ title, subtitle, aside, icon: Icon }: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {subtitle && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">{subtitle}</p>}
        <h2 className="flex items-center gap-2 text-xl font-black text-charcoal">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-charcoal" strokeWidth={2} aria-hidden />}
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

export function EstimateTag({ onWhite = true }: { onWhite?: boolean }) {
  const { t } = useT();
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-3 ${onWhite ? "border-sage/70" : "border-sage"}`}>
      {t.common.estimate}
    </span>
  );
}

/** Tiny line chart for weekly search interest. */
export function Sparkline({ points, className = "h-8 w-24", tone = "#171e19" }: { points: number[]; className?: string; tone?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(30 - (p / max) * 26 - 2).toFixed(1)}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polygon points={`0,30 ${coords.join(" ")} 100,30`} fill={tone} opacity={0.1} />
      <polyline points={coords.join(" ")} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ChangeBadge({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-black tabular-nums ${up ? "text-profit" : "text-red"} ${className}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/** Circular 0–100 score: good = green, middle = charcoal, weak = red (a critical signal). */
export function ScoreRing({ value, size = 88, label }: { value: number; size?: number; label?: string; light?: boolean; onWhite?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? "#1f7a46" : value >= 45 ? "#171e19" : "#ca0013";
  // Malayalam/Hindi labels are too long for the ring; they go underneath instead of being clipped.
  const inside = !!label && label.length <= 7 && /^[\x00-\x7F]*$/.test(label);
  const ring = (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" stroke="rgba(183,198,194,.35)" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={tone}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(value, 100)) / 100)}
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <span className="flex flex-col items-center leading-none">
        <span className="font-black tabular-nums text-charcoal" style={{ fontSize: size * 0.3 }}>{value}</span>
        {inside && <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</span>}
      </span>
    </span>
  );
  if (!label || inside) return ring;
  return (
    <span className="inline-flex shrink-0 flex-col items-center gap-1">
      {ring}
      <span className="text-xs font-bold leading-tight text-ink-3">{label}</span>
    </span>
  );
}

/** Label / value row inside a white card. */
export function DataRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-sage/30 py-2.5 text-[15px]">
      <span className="font-semibold text-ink-2">{label}</span>
      <span className={`text-right tabular-nums ${strong ? "font-black text-charcoal" : "font-bold text-charcoal"}`}>{value}</span>
    </div>
  );
}

/** 3-bar level indicator (e.g. competition), neutral rather than alarming. */
export function LevelBars({ level }: { level: 1 | 2 | 3; onWhite?: boolean }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`w-1 rounded-sm ${n <= level ? "bg-charcoal" : "bg-sage/50"}`} style={{ height: 4 + n * 4 }} />
      ))}
    </span>
  );
}

/** Bento metric card: white 80% glass, 10px sage label, 14px bold value with a red-tint circular icon. */
export function BentoMetric({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: LucideIcon }) {
  return (
    <div className="glass rounded-[16px] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">{label}</p>
      <p className="mt-1.5 flex items-center gap-2 text-sm font-extrabold tabular-nums text-charcoal">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red/10">
          <Icon className="h-4 w-4 text-red" strokeWidth={2.2} aria-hidden />
        </span>
        {value}
      </p>
    </div>
  );
}

/** Label / value row, as in spec lists (landing page). */
export function SpecRow({ label, value }: { label: string; value: React.ReactNode; dark?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-sage/30 py-2 text-sm">
      <span className="font-semibold text-ink-2">{label}</span>
      <span className="text-right font-bold tabular-nums text-charcoal">{value}</span>
    </div>
  );
}
