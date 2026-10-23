export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 h-10 rounded-lg bg-red-700 px-4 font-medium text-white">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-6 text-center">
      <p className="font-medium text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-600">{body}</p>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 60 ? "bg-emerald-100 text-emerald-800" : score >= 35 ? "bg-amber-100 text-amber-800" : "bg-neutral-200 text-neutral-700";
  return (
    <span className={`inline-flex shrink-0 flex-col items-center rounded-lg px-2 py-1 leading-none ${tone}`}>
      <span className="text-lg font-bold tabular-nums">{score}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide">score</span>
    </span>
  );
}

export function LossTrapTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      ⚠ Loss trap
    </span>
  );
}

export function ProductImage({ src, name, className }: { src?: string; name: string; className: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 text-2xl font-bold text-neutral-400 ${className}`} aria-hidden>
        {name.charAt(0)}
      </div>
    );
  }
  // Product images come from many hosts; plain <img> avoids configuring each one for next/image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className={`bg-neutral-100 object-cover ${className}`} loading="lazy" />;
}
