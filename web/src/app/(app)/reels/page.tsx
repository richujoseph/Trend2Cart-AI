"use client";

import { CircleAlert, Clapperboard, Loader } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fmt, useT } from "@/lib/i18n";
import { type Me, type Reel, STATUS_TONE, languageLabel } from "@/lib/reels";
import { EmptyState, ErrorState } from "@/components/states";
import QuotaLine from "@/components/quota-line";
import { PageHero, card } from "@/components/ui";

export default function ReelsPage() {
  const { t, date } = useT();
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    Promise.all([apiFetch<Reel[]>("/reels"), apiFetch<Me>("/me")])
      .then(([r, m]) => {
        if (stale) return;
        setReels(r);
        setMe(m);
      })
      .catch((e: Error) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [attempt]);

  // Keep the list fresh while any Reel is still being made.
  useEffect(() => {
    if (!reels?.some((r) => r.status === "queued" || r.status === "processing")) return;
    const timer = setTimeout(() => {
      apiFetch<Reel[]>("/reels").then(setReels).catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [reels]);

  return (
    <>
      <PageHero icon={Clapperboard} title={t.reels.title} subtitle={t.reels.subtitle} tone="sunset">
        {me && <QuotaLine me={me} tone="light" />}
        <Link href="/reels/new" className="mt-4 inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-bold text-rose-600 shadow-md">
          {t.reels.newReel}
        </Link>
      </PageHero>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        />
      )}
      {!reels && !error && <ListSkeleton />}
      {reels?.length === 0 && <EmptyState icon={Clapperboard} title={t.reels.emptyTitle} body={t.reels.emptyBody} />}
      {reels && reels.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {reels.map((r, i) => (
            <li key={r.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <Link href={`/reels/${r.id}`} className={`${card} block overflow-hidden transition active:scale-[.98]`}>
                <div className="relative aspect-[9/14] bg-gradient-to-br from-brand-700 to-fuchsia-600">
                  {r.status === "done" && r.video_url ? (
                    <video src={`${r.video_url}#t=1.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" aria-hidden />
                  ) : (
                    <span className="flex h-full items-center justify-center text-4xl" aria-hidden>
                      {r.status === "failed" ? <CircleAlert className="h-9 w-9 text-white" aria-hidden /> : <Loader className="h-9 w-9 animate-spin text-white" aria-hidden />}
                    </span>
                  )}
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold shadow ${STATUS_TONE[r.status].tone}`}>
                    {t.reels[STATUS_TONE[r.status].key]}
                  </span>
                  {r.status === "done" && (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-brand-700 shadow-lg">▶</span>
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-sm font-bold">{r.products?.name ?? "Reel"}</p>
                  <p className="line-clamp-1 text-[11px] text-neutral-500">
                    {languageLabel(r.language)} · {date(r.created_at)}
                  </p>
                  {r.audience && <p className="line-clamp-1 text-[11px] text-neutral-400">{fmt(t.reels.forAudience, { audience: r.audience })}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={`${card} animate-pulse overflow-hidden`}>
          <div className="aspect-[9/14] bg-brand-50" />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-3/4 rounded bg-brand-50" />
            <div className="h-3 w-1/2 rounded bg-brand-50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
