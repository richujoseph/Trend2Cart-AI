"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { type Me, type Reel, STATUS_LABEL, languageLabel, shortDate } from "@/lib/reels";
import { EmptyState, ErrorState } from "@/components/states";
import QuotaLine from "@/components/quota-line";

export default function ReelsPage() {
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Reels</h1>
        <Link href="/reels/new" className="flex h-10 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white">
          + New Reel
        </Link>
      </div>
      {me && <QuotaLine me={me} />}

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
      {reels?.length === 0 && (
        <EmptyState
          title="No Reels yet"
          body="Pick a product and we'll make a 15–30 second Reel in Malayalam, Hindi or English."
        />
      )}
      {reels && reels.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {reels.map((r) => (
            <li key={r.id}>
              <Link href={`/reels/${r.id}`} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 active:bg-neutral-50">
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-lg text-white" aria-hidden>
                  ▶
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.products?.name ?? "Product"}</p>
                  <p className="text-xs text-neutral-500">
                    {languageLabel(r.language)} · {shortDate(r.created_at)}
                    {r.audience ? ` · ${r.audience}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[r.status].tone}`}>
                  {STATUS_LABEL[r.status].text}
                </span>
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
    <ul className="mt-4 flex flex-col gap-3" aria-label="Loading Reels">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="h-16 w-12 rounded-md bg-neutral-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-neutral-200" />
            <div className="h-3 w-1/3 rounded bg-neutral-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
