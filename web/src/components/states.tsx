"use client";

import { useT } from "@/lib/i18n";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 h-10 rounded-xl bg-red-700 px-4 font-semibold text-white">
          {t.common.tryAgain}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, icon = "✨" }: { title: string; body: string; icon?: string }) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-200 bg-white/60 p-6 text-center">
      <p className="text-3xl" aria-hidden>{icon}</p>
      <p className="mt-2 font-bold text-brand-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-600">{body}</p>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  const { t } = useT();
  if (score === null) {
    return (
      <span className="inline-flex shrink-0 flex-col items-center rounded-xl bg-neutral-100 px-2 py-1 leading-none text-neutral-500" title={t.score.notScoredTitle}>
        <span className="text-lg font-bold">–</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">{t.score.notScored}</span>
      </span>
    );
  }
  const tone =
    score >= 60
      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
      : score >= 35
        ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
        : "bg-neutral-200 text-neutral-700";
  return (
    <span className={`inline-flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 leading-none shadow-sm ${tone}`}>
      <span className="text-lg font-extrabold tabular-nums">{score}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{t.score.score}</span>
    </span>
  );
}

export function LossTrapTag() {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      ⚠ {t.score.lossTrap}
    </span>
  );
}

export function ProductImage({ src, name, className }: { src?: string; name: string; className: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-100 to-fuchsia-100 text-2xl font-bold text-brand-400 ${className}`} aria-hidden>
        {name.charAt(0)}
      </div>
    );
  }
  // Product images come from many hosts; plain <img> avoids configuring each one for next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className={`bg-white object-cover ${className}`} loading="lazy" />;
}
