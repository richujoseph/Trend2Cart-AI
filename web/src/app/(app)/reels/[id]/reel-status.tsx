"use client";

import { Download, PenLine, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { fmt, useT } from "@/lib/i18n";
import { type Reel, STATUS_TONE, languageLabel } from "@/lib/reels";
import { ErrorState } from "@/components/states";
import { btnPrimary, btnSmall, card } from "@/components/ui";

// The worker reports which step it's on (reels.stage); labels are t.reel.steps in the same order.
const STAGES = ["script", "voice", "video"] as const;

export default function ReelStatus() {
  const { t } = useT();
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

  const current = reel?.status === "processing" ? STAGES.indexOf(reel.stage ?? "script") : -1;

  return (
    <>
      <Link href="/reels" className="text-sm font-medium text-brand-700">{t.reel.back}</Link>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-light tracking-tight text-ink">{reel?.products?.name ?? t.reel.yourReel}</h1>
          {reel && (
            <p className="text-sm text-ink-2">
              {languageLabel(reel.language)}
              {reel.audience ? ` · ${fmt(t.reels.forAudience, { audience: reel.audience })}` : ""}
            </p>
          )}
        </div>
        {reel && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[reel.status].tone}`}>
            {t.reels[STATUS_TONE[reel.status].key]}
          </span>
        )}
      </div>

      {working && (
        <section className={`${card} mt-5 overflow-hidden`} aria-live="polite">
          <div className="bg-gradient-to-r from-brand-600 via-orange-600 to-orange-500 p-4 text-white">
            <p className="text-lg font-bold">{fmt(t.reel.making, { s: seconds })}</p>
            <p className="text-sm text-white/85">
              {reel?.status === "queued" ? t.reel.waitingSlot : t.reel.usuallyReady} {t.reel.canLeave}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white/[0.04] transition-all duration-700" style={{ width: `${((current + 1) / (STAGES.length + 1)) * 100}%` }} />
            </div>
          </div>
          {reel?.status === "queued" && seconds > 45 && (
            <p className="m-4 mb-0 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">{t.reel.offline}</p>
          )}
          <ol className="flex flex-col gap-3 p-4 text-sm">
            {STAGES.map((stage, i) => {
              const state = i < current ? "done" : i === current ? "active" : "todo";
              return (
                <li key={stage} className={`flex items-center gap-3 ${state === "todo" ? "text-ink-3" : "text-ink"}`}>
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "animate-pulse bg-brand-600 text-white" : "bg-brand-50"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={state === "active" ? "font-bold" : ""}>{t.reel.steps[i]}</span>
                  <span className="sr-only">{state === "done" ? t.reel.stepDone : state === "active" ? t.reel.stepActive : ""}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {reel?.status === "done" && reel.video_url && <DoneReel reel={reel} />}

      {reel?.status === "failed" && (
        <section className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          <p>{reel.error ?? t.reel.failedDefault}</p>
          <button onClick={retry} disabled={retrying} className="mt-3 h-11 rounded-xl bg-red-700 px-5 font-bold text-white disabled:opacity-50">
            {retrying ? t.newReel.starting : t.common.tryAgain}
          </button>
          {retryError && <p className="mt-2">{retryError}</p>}
        </section>
      )}
    </>
  );
}

function DoneReel({ reel }: { reel: Reel }) {
  const { t } = useT();
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
      <div className="mx-auto mt-5 w-full max-w-[17rem] rounded-[2rem] bg-gradient-to-br from-brand-600 via-orange-600 to-orange-400 p-1.5 shadow-xl shadow-black/40">
        <video src={reel.video_url!} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-[1.6rem] bg-black" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {/* Supabase Storage sends the file as a download when ?download= is set. */}
        <a href={`${reel.video_url}?download=${encodeURIComponent(fileName)}`} className={btnPrimary}>
          <Download className="h-4 w-4" aria-hidden /> {t.reel.download}
        </a>
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#25D366] px-3 font-semibold text-white shadow-md shadow-emerald-600/25 transition active:scale-[.98] disabled:opacity-60"
        >
          {sharing ? t.reel.preparing : t.reel.share}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-ink-2">{shareError ? t.reel.shareFailed : t.reel.postHint}</p>

      <section className={`${card} mt-5 p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-normal text-ink"><PenLine className="h-4 w-4 text-brand-600" aria-hidden /> {t.reel.captionTitle}</h2>
          <button onClick={copy} className={btnSmall}>
            {copied ? t.common.copied : t.common.copy}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-brand-50/60 p-3 text-sm">{text}</p>
      </section>

      <Link href={`/doctor?reel=${reel.id}`} className="mt-4 block rounded-2xl bg-gradient-to-r from-[#b8321a] to-brand-600 p-4 text-sm text-white shadow-lg shadow-black/40">
        <span className="flex items-center gap-1.5 font-bold"><Stethoscope className="h-4 w-4" aria-hidden /> {t.reel.checkHow}</span>
        <span className="block text-white/85">{t.reel.checkHowSub}</span>
      </Link>
    </>
  );
}
