"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { type Lang, useT } from "@/lib/i18n";
import { useLanguage } from "@/lib/profile";

// Shared looks, so every screen feels like one app.
export const card = "rounded-2xl bg-white shadow-sm shadow-brand-900/5 ring-1 ring-brand-900/5";
export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl py-2 text-center leading-tight bg-gradient-to-r from-brand-600 to-fuchsia-600 px-5 font-semibold text-white shadow-md shadow-brand-600/25 transition active:scale-[.98] disabled:opacity-50 disabled:shadow-none";
export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl py-2 text-center leading-tight bg-white px-5 font-semibold text-brand-800 ring-1 ring-brand-200 transition active:scale-[.98] disabled:opacity-50";
export const btnSmall =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-brand-800 ring-1 ring-brand-200 active:bg-brand-50";
export const input =
  "h-12 w-full rounded-xl border border-brand-100 bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";
export const chip = (active: boolean) =>
  `h-10 shrink-0 rounded-full px-4 text-sm font-medium transition ${
    active ? "bg-brand-700 text-white shadow-sm shadow-brand-700/30" : "bg-white text-neutral-700 ring-1 ring-brand-100"
  }`;

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 via-fuchsia-500 to-orange-400 text-white shadow-md shadow-brand-600/30"
    >
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6.2" />
        <path d="M11 9.5l2 2 3.5-4" />
        <circle cx="10" cy="20.5" r="1" fill="currentColor" />
        <circle cx="17" cy="20.5" r="1" fill="currentColor" />
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
export function LanguageSelect({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { t } = useT();
  const { lang, setLanguage, error } = useLanguage();
  return (
    <span className="relative inline-flex flex-col items-end">
      <label className="relative inline-flex items-center">
        <span className="sr-only">{t.common.language}</span>
        <svg aria-hidden viewBox="0 0 24 24" className={`pointer-events-none absolute left-2.5 h-4 w-4 ${tone === "dark" ? "text-white" : "text-brand-700"}`} fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
        <select
          value={lang}
          onChange={(e) => setLanguage(e.target.value as Lang)}
          className={`h-10 appearance-none rounded-full pl-8 pr-3 text-sm font-semibold outline-none ${
            tone === "dark" ? "bg-white/15 text-white ring-1 ring-white/30" : "bg-brand-50 text-brand-800 ring-1 ring-brand-100"
          }`}
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="text-neutral-900">
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error && <span role="alert" className="absolute top-10 w-48 rounded-lg bg-red-50 p-2 text-xs text-red-700 shadow">{error}</span>}
    </span>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-900/5 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/products" className="flex items-center gap-2">
          <Logo />
          <span className="text-[17px] font-extrabold tracking-tight text-brand-900">
            Trend2Cart <span className="bg-gradient-to-r from-fuchsia-600 to-orange-500 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>
        <LanguageSelect />
      </div>
    </header>
  );
}

/** Colourful page header for the main tabs. */
export function PageHero({ title, subtitle, children, tone = "violet", icon: Icon }: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  tone?: "violet" | "sunset" | "ocean";
  icon?: LucideIcon;
}) {
  const bg = {
    violet: "from-brand-700 via-brand-600 to-fuchsia-600",
    sunset: "from-fuchsia-600 via-rose-500 to-orange-400",
    ocean: "from-teal-600 via-cyan-600 to-brand-600",
  }[tone];
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-5 text-white shadow-lg shadow-brand-900/15`}>
      <span aria-hidden className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-orange-300/20" />
      <div className="relative">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight tracking-tight">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          )}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-white/85">{subtitle}</p>}
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
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-brand-900">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

export function EstimateTag() {
  const { t } = useT();
  return (
    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
      {t.common.estimate}
    </span>
  );
}

/** Tiny line chart for weekly search interest. */
export function Sparkline({ points, className = "h-8 w-24", tone = "#7c3aed" }: { points: number[]; className?: string; tone?: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(30 - (p / max) * 26 - 2).toFixed(1)}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polygon points={`0,30 ${coords.join(" ")} 100,30`} fill={tone} opacity={0.12} />
      <polyline points={coords.join(" ")} fill="none" stroke={tone} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ChangeBadge({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${up ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"} ${className}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/** Circular 0–100 score, coloured by band. */
export function ScoreRing({ value, size = 88, label, light = false }: { value: number; size?: number; label?: string; light?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? "#10b981" : value >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke={light ? "rgba(255,255,255,.25)" : "#ede9fe"} />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={tone}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(value, 100)) / 100)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="flex flex-col items-center leading-none">
        <span className={`font-extrabold tabular-nums ${light ? "text-white" : "text-brand-900"}`} style={{ fontSize: size * 0.3 }}>{value}</span>
        {label && <span className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wide ${light ? "text-white/80" : "text-neutral-500"}`}>{label}</span>}
      </span>
    </span>
  );
}
