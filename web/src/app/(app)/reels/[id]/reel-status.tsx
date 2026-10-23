"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type Reel, STATUS_LABEL, languageLabel } from "@/lib/reels";
import { ErrorState } from "@/components/states";

// The worker reports which step it's on (reels.stage).
const STEPS = [
  { stage: "script", label: "Writing your script…" },
  { stage: "voice", label: "Recording voice…" },
  { stage: "video", label: "Making your video…" },
] as const;

export default function ReelStatus() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reel, setReel] = useState<Reel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const working = !reel || reel.status === "queued" || reel.status === "processing";

  // Poll every 2 s until the Reel is done or failed.
  useEffect(() => {
    if (!working) return;
    let stale = false;
    const load = () =>
      apiFetch<Reel>(`/reels/${id}`)
        .then((r) => !stale && setReel(r))
        .catch((e: Error) => !stale && setError(e.message));
    const timer = setTimeout(load, reel ? 2000 : 0);
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
          // Same photos and opening line as the failed attempt.
          photo_paths: reel.photo_paths ?? [],
          ...(reel.requested_hook && { hook: reel.requested_hook }),
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
          {reel?.status === "queued" && seconds > 45 && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              This is taking longer than usual. The Reel maker may be offline right now. Your Reel is saved and
              will start automatically as soon as it&apos;s back.
            </p>
          )}
          <ol className="mt-4 flex flex-col gap-3 text-sm">
            {STEPS.map((step, i) => {
              const current = reel?.status === "processing" ? STEPS.findIndex((s) => s.stage === (reel.stage ?? "script")) : -1;
              const state = i < current ? "done" : i === current ? "active" : "todo";
              return (
                <li key={step.stage} className={`flex items-center gap-3 ${state === "todo" ? "text-neutral-400" : "text-neutral-900"}`}>
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      state === "done" ? "bg-emerald-600 text-white" : state === "active" ? "animate-pulse bg-neutral-900 text-white" : "bg-neutral-100"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={state === "active" ? "font-semibold" : ""}>{step.label}</span>
                  <span className="sr-only">{state === "done" ? "(done)" : state === "active" ? "(in progress)" : ""}</span>
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
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);
  const text = [reel.caption, (reel.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
  const fileName = `${(reel.products?.name ?? "reel").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-reel.mp4`;

  // Phones can share the video file itself (WhatsApp Status, Instagram); elsewhere fall back to a WhatsApp link.
  async function share() {
    const whatsapp = () =>
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${reel.video_url}`)}`, "_blank", "noreferrer");
    // Decide before any await: browsers only allow window.open straight after the tap.
    if (!navigator.canShare?.({ files: [new File([], fileName, { type: "video/mp4" })] })) return whatsapp();
    setSharing(true);
    try {
      const blob = await fetch(reel.video_url!).then((r) => r.blob());
      await navigator.share({ files: [new File([blob], fileName, { type: "video/mp4" })], text });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setShareError(true); // AbortError = seller closed the share sheet
    } finally {
      setSharing(false);
    }
  }

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
      <div className="mt-3 grid grid-cols-2 gap-2">
        {/* Supabase Storage sends the file as a download when ?download= is set. */}
        <a
          href={`${reel.video_url}?download=${encodeURIComponent(fileName)}`}
          className="flex h-12 items-center justify-center rounded-lg bg-neutral-900 font-medium text-white"
        >
          Download MP4
        </a>
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="h-12 rounded-lg bg-emerald-600 font-medium text-white disabled:opacity-60"
        >
          {sharing ? "Preparing…" : "Share to WhatsApp"}
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-neutral-500">
        {shareError
          ? "Sharing didn't work on this phone. Tap Download, then share the video from your gallery."
          : "Then post it on Instagram or your WhatsApp Status with the caption below."}
      </p>

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
