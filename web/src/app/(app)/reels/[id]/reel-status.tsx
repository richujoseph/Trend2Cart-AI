"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Reel, STATUS_LABEL, languageLabel } from "@/lib/reels";
import { ErrorState } from "@/components/states";

const STEPS = ["Writing your script", "Recording the voice", "Adding captions", "Making the video"];

export default function ReelStatus() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reel, setReel] = useState<Reel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const working = !reel || reel.status === "queued" || reel.status === "processing";

  // Poll every 3 s until the Reel is done or failed.
  useEffect(() => {
    if (!working) return;
    let stale = false;
    const load = () =>
      apiFetch<Reel>(`/reels/${id}`)
        .then((r) => !stale && setReel(r))
        .catch((e: Error) => !stale && setError(e.message));
    const timer = setTimeout(load, reel ? 3000 : 0);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [id, reel, working]);

  useEffect(() => {
    if (!working) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [working]);

  async function retry() {
    if (!reel) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const next = await apiFetch<{ id: string }>("/reels", {
        method: "POST",
        body: JSON.stringify({
          product_id: reel.product_id, audience: reel.audience ?? "online shoppers in Kerala",
          language: reel.language, template_id: reel.template_id,
        }),
      });
      router.push(`/reels/${next.id}`);
    } catch (err) {
      setRetryError((err as ApiError).message);
      setRetrying(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <>
      <Link href="/reels" className="text-sm text-neutral-600">← Your Reels</Link>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{reel?.products?.name ?? "Your Reel"}</h1>
          {reel && <p className="text-sm text-neutral-500">{languageLabel(reel.language)}{reel.audience ? ` · for ${reel.audience}` : ""}</p>}
        </div>
        {reel && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[reel.status].tone}`}>
            {STATUS_LABEL[reel.status].text}
          </span>
        )}
      </div>

      {working && (
        <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4" aria-live="polite">
          <p className="font-medium">Making your Reel… {seconds}s</p>
          <p className="text-sm text-neutral-500">
            {reel?.status === "queued" ? "Waiting for a free slot." : "Usually ready in under a minute."} You can leave this page.
          </p>
          <ol className="mt-4 flex flex-col gap-2 text-sm">
            {STEPS.map((step, i) => {
              // The worker doesn't report its stage; this paces the list roughly like a typical job.
              const active = reel?.status === "processing" && Math.min(Math.floor(seconds / 8), STEPS.length - 1) === i;
              return (
                <li key={step} className={active ? "font-semibold text-neutral-900" : "text-neutral-400"}>
                  {active ? "● " : "○ "}{step}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {reel?.status === "done" && reel.video_url && <DoneReel reel={reel} />}

      {reel?.status === "failed" && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p>{reel.error ?? "Something went wrong while making your Reel."}</p>
          <button onClick={retry} disabled={retrying} className="mt-3 h-11 rounded-lg bg-red-700 px-4 font-medium text-white disabled:opacity-50">
            {retrying ? "Starting…" : "Try again"}
          </button>
          {retryError && <p className="mt-2">{retryError}</p>}
        </section>
      )}
    </>
  );
}

function DoneReel({ reel }: { reel: Reel }) {
  const [copied, setCopied] = useState(false);
  const text = [reel.caption, (reel.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <video
        src={reel.video_url!}
        controls
        playsInline
        preload="metadata"
        className="mx-auto mt-4 aspect-[9/16] w-full max-w-xs rounded-xl bg-black"
      />
      <a
        href={reel.video_url!}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex h-12 items-center justify-center rounded-lg bg-neutral-900 font-medium text-white"
      >
        Open video to save it
      </a>
      <p className="mt-1 text-center text-xs text-neutral-500">On your phone: open it, then tap ⋮ or share → Save/Download.</p>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Caption & hashtags</h2>
          <button onClick={copy} className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-3 text-sm">{text}</p>
      </section>

      <Link href={`/doctor?reel=${reel.id}`} className="mt-6 block rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <span className="font-semibold">Posted it? Check how it did →</span>
        <span className="block text-neutral-500">After a few days, enter its views and orders in Conversion Doctor.</span>
      </Link>
    </>
  );
}
