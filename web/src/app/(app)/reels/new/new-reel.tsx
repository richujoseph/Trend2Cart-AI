"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { fmt, showLanguage, useT } from "@/lib/i18n";
import { type ProductListItem, formatRupees } from "@/lib/products";
import { LANGUAGES, type Language, type Me, REGIONS, TEMPLATES } from "@/lib/reels";
import { saveProfile } from "@/lib/profile";
import { ErrorState, LossTrapTag, ProductImage } from "@/components/states";
import QuotaLine from "@/components/quota-line";
import { btnPrimary, btnSecondary, card, input } from "@/components/ui";
import { deleteSellerPhoto, uploadSellerPhoto } from "@/lib/photos";

const MAX_PHOTOS = 4;

export default function NewReel() {
  const { t, lang: appLang } = useT();
  const STEPS = t.newReel.steps;
  const router = useRouter();
  const params = useSearchParams();
  const preselected = params.get("product");
  const langParam = params.get("lang");
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState(preselected ?? "");
  const [audience, setAudience] = useState("");
  const [hook, setHook] = useState(params.get("hook")?.slice(0, 100) ?? "");
  const [language, setLanguage] = useState<Language | null>(
    LANGUAGES.some((l) => l.value === langParam) ? (langParam as Language) : null,
  );
  const [templateId, setTemplateId] = useState(1);
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<ProductListItem[]>("/products?sort=profit"), apiFetch<Me>("/me")])
      .then(([p, m]) => {
        setProducts(p);
        setMe(m);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // A language picked for this Reel wins; otherwise the app language (the seller's saved default).
  const lang = language ?? appLang;
  const product = products?.find((p) => p.id === productId);
  const outOfReels = me?.reels.left === 0;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    setUploading(true);
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      try {
        const uploaded = await uploadSellerPhoto(file);
        setPhotos((p) => [...p, uploaded]);
      } catch (err) {
        setPhotoError((err as Error).message);
      }
    }
    setUploading(false);
  }

  function removePhoto(path: string) {
    setPhotos((p) => p.filter((x) => x.path !== path));
    deleteSellerPhoto(path).catch(() => {});
  }

  async function chooseRegion(region: (typeof REGIONS)[number]) {
    if (!me) return;
    setRegionError(null);
    try {
      await saveProfile({ region: region.value, language: region.language });
      setMe({ ...me, profile: { ...me.profile, region: region.value, language: region.language } });
      showLanguage(region.language);
      setLanguage(null);
    } catch (err) {
      setRegionError((err as Error).message);
    }
  }

  function next() {
    setError(null);
    if (step === 1 && !productId) return setError({ message: t.newReel.errProduct, limit: false });
    if (step === 2 && audience.trim().length < 3) return setError({ message: t.newReel.errAudience, limit: false });
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length) return next(); // Enter on an earlier step moves forward instead of submitting
    setBusy(true);
    setError(null);
    try {
      const reel = await apiFetch<{ id: string }>("/reels", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId, audience: audience.trim(), language: lang, template_id: templateId,
          photo_paths: photos.map((p) => p.path),
          ...(hook.trim().length >= 3 && { hook: hook.trim() }),
        }),
      });
      router.push(`/reels/${reel.id}`);
    } catch (err) {
      const e = err as ApiError;
      setError({ message: e.message, limit: e.status === 429 });
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => window.location.reload()} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <Link href="/reels" className="text-sm font-medium text-brand-700">{t.newReel.back}</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-900">🎬 {t.newReel.title}</h1>
        {me && <QuotaLine me={me} />}
      </div>

      {outOfReels && (
        <div role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          {t.newReel.outOfReels}
          <Link href="/pricing" className="mt-1 block font-bold underline">{t.newReel.getUnlimited99}</Link>
        </div>
      )}

      <ol className="grid grid-cols-3 gap-2" aria-label={t.newReel.stepsLabel}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              <button type="button" disabled={n >= step} onClick={() => setStep(n)} className="flex w-full min-w-0 items-center gap-1.5 text-left disabled:cursor-default">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === "done" ? "bg-emerald-500 text-white" : state === "current" ? "bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white shadow-md shadow-brand-600/30" : "bg-white text-neutral-400 ring-1 ring-brand-100"
                  }`}
                >
                  {state === "done" ? "✓" : n}
                </span>
                <span className={`min-w-0 break-words text-[11px] leading-tight ${state === "current" ? "font-bold text-brand-900" : "text-neutral-500"}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {step > 1 && product && (
        <div className={`${card} flex items-center gap-3 p-2`}>
          <ProductImage src={photos[0]?.preview ?? product.image_urls[0]} name={product.name} className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-bold">{product.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {formatRupees(product.selling_price_paise)}
              {photos.length > 0 && ` · ${fmt(t.newReel.photoCount, { n: photos.length })}`}
              {step > 2 && audience && ` · ${fmt(t.reels.forAudience, { audience: audience.trim() })}`}
            </p>
          </div>
          <button type="button" onClick={() => setStep(1)} className="shrink-0 px-2 text-sm font-semibold text-brand-700 underline">{t.common.change}</button>
        </div>
      )}

      {step === 1 && (
        <>
          {/* min-w-0: fieldsets are as wide as their content by default, so long names would overflow the screen. */}
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-bold">{t.newReel.whichProduct}</legend>
            {products ? (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-2 transition ${productId === p.id ? "ring-2 ring-brand-600 shadow-md shadow-brand-600/15" : "ring-1 ring-brand-900/5"}`}
                  >
                    <input type="radio" name="product" value={p.id} checked={productId === p.id} onChange={() => setProductId(p.id)} className="sr-only" />
                    <ProductImage src={p.image_urls[0]} name={p.name} className="h-14 w-14 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-neutral-500">
                        {fmt(t.newReel.sellsAt, { price: formatRupees(p.selling_price_paise) })} ·{" "}
                        <b className={p.profit_paise >= 0 ? "text-emerald-700" : "text-red-600"}>
                          {p.profit_paise >= 0 ? t.common.profit : t.common.loss} {formatRupees(Math.abs(p.profit_paise))}{t.common.perOrder}
                        </b>
                      </span>
                      {p.loss_trap && <span className="mt-1 block"><LossTrapTag /></span>}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${productId === p.id ? "bg-brand-600 text-white" : "ring-1 ring-brand-200"}`}
                    >
                      {productId === p.id ? "✓" : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white/70" />)}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">
              📸 {t.newReel.photos} <span className="font-normal text-neutral-500">{t.newReel.recommended}</span>
            </span>
            <p className="text-xs text-neutral-500">{fmt(t.newReel.photosHint, { n: MAX_PHOTOS })}</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative aspect-square overflow-hidden rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt={t.newReel.yourPhoto} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.path)}
                    aria-label={t.newReel.removePhoto}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-white/60 text-xs font-medium text-brand-700">
                  <span className="text-2xl leading-none">{uploading ? "…" : "+"}</span>
                  {uploading ? t.newReel.uploading : t.newReel.add}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            {photos.length === 0 && <p className="text-xs text-neutral-500">{t.newReel.noPhotos}</p>}
            {photoError && <p role="alert" className="text-xs text-red-700">{photoError}</p>}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold">🎯 {t.newReel.whoFor}</span>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={80} placeholder={t.newReel.audiencePlaceholder} className={input} />
            <span className="text-xs text-neutral-500">{t.newReel.audienceHint}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {t.newReel.ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                aria-pressed={audience === idea}
                onClick={() => setAudience(idea)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${audience === idea ? "bg-brand-700 text-white" : "bg-white text-neutral-700 ring-1 ring-brand-100"}`}
              >
                {idea}
              </button>
            ))}
          </div>
          {hook && (
            <div className="flex items-start justify-between gap-2 rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              <span>
                <span className="block text-xs font-bold text-amber-900">{t.newReel.openingLine}</span>
                “{hook}”
              </span>
              <button type="button" onClick={() => setHook("")} aria-label={t.newReel.removeOpening} className="shrink-0 text-amber-900">
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && me && (
        <>
          {!me.profile.region && (
            <fieldset className={`${card} p-3`}>
              <legend className="float-left w-full text-sm font-bold">📍 {t.newReel.whereSell}</legend>
              <p className="text-xs text-neutral-500">{t.newReel.whereSellHint}</p>
              <div className="clear-both mt-2 grid grid-cols-2 gap-2 pt-1">
                {REGIONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => chooseRegion(r)} className={btnSecondary}>
                    {t.regions[r.value]}
                  </button>
                ))}
              </div>
              {regionError && <p role="alert" className="mt-1 text-xs text-red-700">{regionError}</p>}
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">🗣️ {t.newReel.language}</legend>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={lang === l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`h-14 rounded-xl text-sm transition ${lang === l.value ? "bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white shadow-md shadow-brand-600/25" : "bg-white ring-1 ring-brand-100"}`}
                >
                  <span className="block font-bold">{l.native}</span>
                  {l.native !== l.label && <span className="block text-xs opacity-75">{l.label}</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">🎨 {t.newReel.style}</legend>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={templateId === tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-2xl p-1 transition ${templateId === tpl.id ? "bg-white ring-2 ring-brand-600 shadow-md" : ""}`}
                >
                  <div className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-xl" style={{ background: tpl.bg }}>
                    <span className="absolute left-1/2 top-[12%] -translate-x-1/2 rounded px-1 text-[10px] font-bold" style={{ background: tpl.accent, color: tpl.bg }}>
                      ₹
                    </span>
                    <span className="absolute inset-x-2 bottom-[22%] h-1.5 rounded" style={{ background: tpl.text }} />
                    <span className="absolute inset-x-4 bottom-[17%] h-1.5 rounded" style={{ background: tpl.text }} />
                  </div>
                  <span className="mt-1 block text-xs font-medium">{tpl.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error.message}
          {error.limit && <Link href="/pricing" className="mt-2 block font-bold underline">{t.newReel.seePlan}</Link>}
        </div>
      )}

      {/* Stays above the bottom nav so Next is always in reach on a long product list. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 bg-canvas/90 px-4 py-3 backdrop-blur">
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className={btnSecondary}>
            {t.common.back}
          </button>
        )}
        {/* Separate keys: reusing one element would turn "Next" into the submit button mid-click and skip step 3. */}
        {step < STEPS.length ? (
          <button key="next" type="button" onClick={next} disabled={uploading} className={`${btnPrimary} flex-1`}>
            {uploading ? t.newReel.uploadingPhotos : `${t.common.next} →`}
          </button>
        ) : (
          <button key="generate" disabled={busy || outOfReels || uploading || !me} className={`${btnPrimary} flex-1`}>
            {busy ? t.newReel.starting : outOfReels ? t.newReel.noneLeft : `✨ ${t.newReel.generate}`}
          </button>
        )}
      </div>
      {step === STEPS.length && outOfReels && (
        <Link href="/pricing" className="-mt-3 text-center text-sm font-bold text-brand-700 underline">{t.newReel.getUnlimited99}</Link>
      )}
      {step === STEPS.length && !outOfReels && <p className="-mt-3 text-center text-xs text-neutral-500">{t.newReel.takes}</p>}
    </form>
  );
}
