"use client";

import { Sparkles, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 h-10 rounded-xl bg-red-700 px-4 font-semibold text-white">
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon = Sparkles }: { title: string; body: string; icon?: LucideIcon }) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-200 bg-white/[0.03] p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-2 font-bold text-brand-900">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{body}</p>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  const { t } = useT();
  if (score === null) {
    return (
      <span className="inline-flex shrink-0 flex-col items-center rounded-xl bg-white/[0.06] px-2 py-1 leading-none text-ink-2" title={t.score.notScoredTitle}>
        <span className="text-lg font-bold">–</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">{t.score.notScored}</span>
      </span>
    );
  }
  const tone =
    score >= 60
      ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
      : score >= 35
        ? "bg-gradient-to-br from-amber-400 to-orange-600 text-white"
        : "bg-white/10 text-ink/85";
  return (
    <span className={`inline-flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 leading-none shadow-sm ${tone}`}>
      <span className="text-lg font-medium tabular-nums">{score}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{t.score.score}</span>
    </span>
  );
}

export function LossTrapTag() {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
      ⚠ {t.score.lossTrap}
    </span>
  );
}

export function ProductImage({ src, name, className }: { src?: string; name: string; className: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-orange-100 text-2xl font-bold text-brand-400 ${className}`} aria-hidden>
        {name.charAt(0)}
      </div>
    );
  }
  // Product images come from many hosts; plain <img> avoids configuring each one for next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className={`bg-white/[0.04] object-cover ${className}`} loading="lazy" />;
}
