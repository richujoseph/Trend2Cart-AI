"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { type Lang, useT } from "@/lib/i18n";
import { useLanguage } from "@/lib/profile";

// Shared looks: warm black, crimson → ember accents, glass surfaces, pill buttons, light large type.
export const card =
  "rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] ring-1 ring-white/[0.08] backdrop-blur-xl";
/** Pill buttons (design spec): light = white on dark, dark = black on white cards, glass, ghost. */
export const btn = {
  light:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-2 text-center text-[15px] font-medium leading-tight text-[#0b0706] transition hover:bg-[#f5efec] active:scale-[.98] disabled:opacity-40",
  dark:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0b0706] px-6 py-2 text-center text-[15px] font-medium leading-tight text-white transition hover:bg-black active:scale-[.98] disabled:opacity-40",
  glass:
    "glass inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-2 text-center text-[15px] font-medium leading-tight text-ink transition hover:bg-white/10 active:scale-[.98] disabled:opacity-40",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-ink-2 transition hover:text-ink disabled:opacity-40",
};
/** Glass card for inputs and content on dark backgrounds. */
export const glassCard = "glass rounded-[24px]";
/** White data card for numbers and breakdowns. */
export const dataCard = "rounded-[24px] bg-white text-[#0b0706] shadow-[0_8px_32px_rgba(0,0,0,0.35)]";
/** Glass input on dark. */
export const glassInput =
  "glass h-12 w-full rounded-[16px] px-4 text-[15px] text-ink outline-none transition placeholder:text-ink-2 focus:border-ember-300/60";

/** White stat card, like "Our impact in numbers" in the brand reference. */
export const cardLight = "rounded-2xl bg-[#f6f1ed] text-[#160c0a] shadow-2xl shadow-black/40";
export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f6f1ed] px-6 py-2 text-center text-sm font-medium leading-tight text-[#140b09] shadow-lg shadow-black/30 transition hover:bg-white active:scale-[.98] disabled:opacity-40";
export const btnAccent =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#b8321a] to-[#f06a3c] px-6 py-2 text-center text-sm font-medium leading-tight text-white shadow-lg shadow-[#dc4a26]/25 transition active:scale-[.98] disabled:opacity-40";
export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/[0.04] px-6 py-2 text-center text-sm font-medium leading-tight text-ink ring-1 ring-white/15 backdrop-blur transition hover:bg-white/[0.08] active:scale-[.98] disabled:opacity-40";
export const btnSmall =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] px-4 text-sm font-medium text-ink ring-1 ring-white/15 hover:bg-white/10";
export const input =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-ink outline-none transition placeholder:text-ink-3 focus:border-brand-500/70 focus:ring-4 focus:ring-brand-500/15";
export const chip = (active: boolean) =>
  `h-10 shrink-0 rounded-full px-4 text-sm transition ${
    active ? "bg-[#f6f1ed] font-medium text-[#140b09]" : "bg-white/[0.04] text-ink-2 ring-1 ring-white/12 hover:text-ink"
  }`;

/** Flowing crimson silk folds, drawn as layered SVG bands (no stock imagery). */
export function Ribbons({ className = "", seed = 0 }: { className?: string; seed?: number }) {
  const bands = Array.from({ length: 9 }, (_, i) => {
    const base = 40 + i * 62;
    const amp = 70 + (i % 3) * 22;
    const phase = seed + i * 0.55;
    const thick = 46 + (i % 4) * 9;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let k = 0; k <= 24; k++) {
      const x = -60 + k * 40;
      const y = base + amp * Math.sin((x / 900) * Math.PI * 1.6 + phase) + 18 * Math.sin((x / 900) * Math.PI * 5 + phase * 2);
      top.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      bottom.unshift(`${x.toFixed(1)},${(y + thick + 14 * Math.sin((x / 900) * Math.PI * 3 + phase)).toFixed(1)}`);
    }
    return { d: `M${top.join(" L")} L${bottom.join(" L")} Z`, edge: `M${top.join(" L")}`, i };
  });
  return (
    <svg viewBox="0 0 900 640" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none ${className}`} aria-hidden>
      <defs>
        <linearGradient id={`rb-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d0b06" />
          <stop offset="0.35" stopColor="#a8200e" />
          <stop offset="0.65" stopColor="#e5401d" />
          <stop offset="1" stopColor="#ff9b66" />
        </linearGradient>
        <linearGradient id={`rs-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`rg-${seed}`} cx="0.7" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ff6a3d" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff6a3d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="900" height="640" fill={`url(#rg-${seed})`} />
      {bands.map((b) => (
        <g key={b.i} opacity={0.7 + (b.i % 3) * 0.1}>
          <path d={b.d} fill={`url(#rb-${seed})`} />
          <path d={b.d} fill={`url(#rs-${seed})`} />
          <path d={b.edge} fill="none" stroke="#ffc2a3" strokeOpacity="0.55" strokeWidth="1.6" />
        </g>
      ))}
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#140b09] ring-1 ring-white/15"
    >
      <span className="absolute inset-0 bg-gradient-to-br from-[#7d1a0e] via-[#d4401f] to-[#f58a55] opacity-90" />
      <svg viewBox="0 0 24 24" className="relative h-[58%] w-[58%] text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6.2" />
        <path d="M11 9.5l2 2 3.5-4" />
      </svg>
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
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 h-4 w-4 text-ink-2" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
        <select
          value={lang}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className="h-10 appearance-none rounded-full bg-white/[0.05] pl-9 pr-4 text-sm text-ink outline-none ring-1 ring-white/15"
        >
          {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {error && <span role="alert" className="absolute top-11 z-30 w-48 rounded-xl bg-red-950 p-2 text-xs text-red-200 ring-1 ring-red-500/30">{error}</span>}
    </span>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-canvas/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/products" className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-[15px] font-medium tracking-tight text-ink">Trend2Cart</span>
        </Link>
        <LanguageSelect />
      </div>
    </header>
  );
}

/** Page header: dark panel with crimson ribbons and light large type. */
export function PageHero({ title, subtitle, children, icon: Icon, seed = 0 }: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  seed?: number;
  tone?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#0d0706] p-5 ring-1 ring-white/[0.08]">
      <Ribbons seed={seed} className="absolute -right-24 -top-10 h-[130%] w-[150%] opacity-90 animate-drift" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0706] via-[#0d0706]/70 to-transparent" aria-hidden />
      <div className="relative">
        {Icon && (
          <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15 backdrop-blur">
            <Icon className="h-[18px] w-[18px] text-ink" aria-hidden />
          </span>
        )}
        <h1 className="text-[28px] font-light leading-[1.1] tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-2">{subtitle}</p>}
        {children}
      </div>
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
    <div className="flex items-end justify-between gap-3 border-b border-white/[0.07] pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-xl font-light tracking-tight text-ink">
          {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-brand-500" aria-hidden />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export function EstimateTag({ onWhite = false }: { onWhite?: boolean }) {
  const { t } = useT();
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ring-1 ${onWhite ? "text-rust-600 ring-rust-600/35" : "text-ember-300 ring-ember-300/40"}`}>
      {t.common.estimate}
    </span>
  );
}

/** Tiny line chart for weekly search interest. */
export function Sparkline({ points, className = "h-8 w-24", tone = "#ee6640" }: { points: number[]; className?: string; tone?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(30 - (p / max) * 26 - 2).toFixed(1)}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polygon points={`0,30 ${coords.join(" ")} 100,30`} fill={tone} opacity={0.15} />
      <polyline points={coords.join(" ")} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ChangeBadge({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ${up ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" : "bg-red-400/10 text-red-300 ring-red-400/20"} ${className}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/** Circular 0–100 score, coloured by band. */
export function ScoreRing({ value, size = 88, label, onWhite = false }: { value: number; size?: number; label?: string; light?: boolean; onWhite?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  // One warm family plus semantic green/red: good = profit green, middle = ember, weak = loss red.
  const tone = value >= 70 ? (onWhite ? "#15803d" : "#4ade80") : value >= 45 ? "#f06a3a" : onWhite ? "#b91c1c" : "#f87171";
  // Malayalam/Hindi labels are too long for the ring; they go underneath instead of being clipped.
  const inside = !!label && label.length <= 7 && /^[\x00-\x7F]*$/.test(label);
  const ring = (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="7" stroke={onWhite ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.08)"} />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={tone}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(value, 100)) / 100)}
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <span className="flex flex-col items-center leading-none">
        <span className={`font-medium tabular-nums ${onWhite ? "text-[#0b0706]" : "text-ink"}`} style={{ fontSize: size * 0.3 }}>{value}</span>
        {inside && <span className={`mt-1 text-[10px] uppercase tracking-[0.12em] ${onWhite ? "text-black/55" : "text-ink-2"}`}>{label}</span>}
      </span>
    </span>
  );
  if (!label || inside) return ring;
  return (
    <span className="inline-flex shrink-0 flex-col items-center gap-1">
      {ring}
      <span className={`text-xs leading-tight ${onWhite ? "text-black/55" : "text-ink-2"}`}>{label}</span>
    </span>
  );
}

/** Flowing rust → ember waves behind a section. Pure SVG (a few KB), transform-only drift. */
export function RibbonBackground({ variant = "section", className = "" }: { variant?: "hero" | "section" | "subtle"; className?: string }) {
  const opacity = { hero: 1, section: 0.75, subtle: 0.4 }[variant];
  const id = `rbg-${variant}`;
  const waves = [0, 1, 2, 3].map((i) => {
    const base = 60 + i * 55;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let k = 0; k <= 12; k++) {
      const x = -40 + k * 40;
      const y = base + (46 + i * 8) * Math.sin((x / 440) * Math.PI * 1.4 + i * 0.9) + 10 * Math.sin((x / 440) * Math.PI * 4 + i);
      top.push(`${x},${y.toFixed(1)}`);
      bottom.unshift(`${x},${(y + 34 + i * 6).toFixed(1)}`);
    }
    return `M${top.join(" L")} L${bottom.join(" L")} Z`;
  });
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ opacity }}>
      <svg viewBox="0 0 440 320" preserveAspectRatio="xMidYMid slice" className="h-full w-full animate-drift">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0" stopColor="#7a1f0e" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#f06a3a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#f06a3a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.85" cy="0.1" r="0.6">
            <stop offset="0" stopColor="#f06a3a" stopOpacity="0.25" />
            <stop offset="1" stopColor="#f06a3a" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-soft`}><feGaussianBlur stdDeviation="1.4" /></filter>
        </defs>
        <rect width="440" height="320" fill={`url(#${id}-glow)`} />
        {waves.map((d, i) => (
          <path key={i} d={d} fill={`url(#${id})`} opacity={0.35 + i * 0.15} filter={`url(#${id}-soft)`} />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-canvas" />
    </div>
  );
}

/** Label / value row on a white data card. */
export function DataRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-black/[0.08] py-2.5 text-[15px]">
      <span className="text-black/55">{label}</span>
      <span className={`text-right tabular-nums ${strong ? "font-medium text-black" : "text-black/85"}`}>{value}</span>
    </div>
  );
}

/** 3-bar level indicator (e.g. competition), neutral rather than alarming. */
export function LevelBars({ level, onWhite = false }: { level: 1 | 2 | 3; onWhite?: boolean }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-1 rounded-sm ${n <= level ? (onWhite ? "bg-[#0b0706]" : "bg-ink") : onWhite ? "bg-black/15" : "bg-white/20"}`}
          style={{ height: 4 + n * 4 }}
        />
      ))}
    </span>
  );
}

/** Label / value row, as in the reference's spec lists. */
export function SpecRow({ label, value, dark = false }: { label: string; value: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-t py-2 text-sm ${dark ? "border-black/10" : "border-white/[0.07]"}`}>
      <span className={dark ? "text-black/55" : "text-ink-2"}>{label}</span>
      <span className={`text-right tabular-nums ${dark ? "text-black/85" : "text-ink"}`}>{value}</span>
    </div>
  );
}
