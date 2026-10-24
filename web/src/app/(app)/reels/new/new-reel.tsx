"use client";

import { Camera, Clapperboard, Languages, MapPin, Palette, Users } from "lucide-react";
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
import { RibbonBackground, btn, glassCard, glassInput } from "@/components/ui";
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
    <form onSubmit={submit} className="relative isolate flex flex-col gap-6">
      <RibbonBackground variant="subtle" className="-z-10 -mx-5 -mt-4 h-72" />
      <div>
        <Link href="/reels" className={`${btn.ghost} -ml-3`}>{t.newReel.back}</Link>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight text-ink"><Clapperboard className="h-6 w-6 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.title}</h1>
        {me && <QuotaLine me={me} />}
      </div>

      {outOfReels && (
        <div role="status" className={`${glassCard} p-4 text-[15px] text-ink`}>
          {t.newReel.outOfReels}
          <Link href="/pricing" className="mt-2 inline-flex min-h-11 items-center font-medium text-ember-300">{t.newReel.getUnlimited99}</Link>
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
                    state === "done" ? "bg-sage/40 text-charcoal" : state === "current" ? "bg-charcoal text-white" : "glass text-ink-3"
                  }`}
                >
                  {state === "done" ? "✓" : n}
                </span>
                <span className={`min-w-0 text-xs leading-tight ${state === "current" ? "font-medium text-ink" : "text-ink-2"}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {step > 1 && product && (
        <div className={`${glassCard} flex items-center gap-3 p-3`}>
          <span className="flex h-12 w-12 shrink-0 rounded-[12px] bg-card-muted p-1">
            <ProductImage src={photos[0]?.preview ?? product.image_urls[0]} name={product.name} className="h-full w-full rounded-[8px]" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-[15px] font-medium">{product.name}</p>
            <p className="truncate text-xs text-ink-2">
              {formatRupees(product.selling_price_paise)}
              {photos.length > 0 && ` · ${fmt(t.newReel.photoCount, { n: photos.length })}`}
              {step > 2 && audience && ` · ${fmt(t.reels.forAudience, { audience: audience.trim() })}`}
            </p>
          </div>
          <button type="button" onClick={() => setStep(1)} className="min-h-11 shrink-0 px-2 text-[15px] font-medium text-ember-300">{t.common.change}</button>
        </div>
      )}

      {step === 1 && (
        <>
          {/* min-w-0: fieldsets are as wide as their content by default, so long names would overflow the screen. */}
          <fieldset className="min-w-0">
            <legend className="mb-3 text-2xl font-black text-ink">{t.newReel.whichProduct}</legend>
            {products ? (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={`glass flex cursor-pointer items-center gap-3 rounded-[24px] p-3 transition ${productId === p.id ? "ring-2 ring-ember-400" : ""}`}
                  >
                    <input type="radio" name="product" value={p.id} checked={productId === p.id} onChange={() => setProductId(p.id)} className="sr-only" />
                    <span className="flex h-14 w-14 shrink-0 rounded-[14px] bg-card-muted p-1">
                      <ProductImage src={p.image_urls[0]} name={p.name} className="h-full w-full rounded-[10px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium leading-snug">{p.name}</span>
                      <span className="block text-xs text-ink-2">
                        {fmt(t.newReel.sellsAt, { price: formatRupees(p.selling_price_paise) })} ·{" "}
                        <b className={`font-medium tabular-nums ${p.profit_paise >= 0 ? "text-profit" : "text-loss"}`}>
                          {p.profit_paise >= 0 ? t.common.profit : t.common.loss} {formatRupees(Math.abs(p.profit_paise))}{t.common.perOrder}
                        </b>
                      </span>
                      {p.loss_trap && <span className="mt-1 block"><LossTrapTag /></span>}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${productId === p.id ? "bg-charcoal text-white" : "ring-1 ring-sage/40"}`}
                    >
                      {productId === p.id ? "✓" : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton-dark h-[82px] rounded-[24px]" />)}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-medium">
              <Camera className="inline h-4 w-4 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.photos} <span className="font-normal text-ink-2">{t.newReel.recommended}</span>
            </span>
            <p className="text-xs text-ink-2">{fmt(t.newReel.photosHint, { n: MAX_PHOTOS })}</p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <div key={p.path} className="glass relative aspect-square overflow-hidden rounded-[16px]">
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
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed border-sage/60 bg-card-muted text-xs font-medium text-ink-2">
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
            {photos.length === 0 && <p className="text-xs text-ink-2">{t.newReel.noPhotos}</p>}
            {photoError && <p role="alert" className="text-[13px] text-loss">{photoError}</p>}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-2xl font-black text-ink"><Users className="h-5 w-5 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.whoFor}</span>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={80} placeholder={t.newReel.audiencePlaceholder} className={`${glassInput} h-14`} />
            <span className="text-[13px] text-ink-2">{t.newReel.audienceHint}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {t.newReel.ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                aria-pressed={audience === idea}
                onClick={() => setAudience(idea)}
                className={`min-h-11 rounded-full px-4 text-[13px] transition ${audience === idea ? "bg-white font-medium text-charcoal" : "glass text-ink-2"}`}
              >
                {idea}
              </button>
            ))}
          </div>
          {hook && (
            <div className={`${glassCard} flex items-start justify-between gap-2 p-4 text-[15px]`}>
              <span>
                <span className="block text-xs font-medium text-ember-300">{t.newReel.openingLine}</span>
                “{hook}”
              </span>
              <button type="button" onClick={() => setHook("")} aria-label={t.newReel.removeOpening} className="flex h-11 w-11 shrink-0 items-center justify-center text-ink-2">
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && me && (
        <>
          {!me.profile.region && (
            <fieldset className={`${glassCard} p-4`}>
              <legend className="float-left flex w-full items-center gap-1.5 text-[15px] font-medium"><MapPin className="h-4 w-4 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.whereSell}</legend>
              <p className="text-xs text-ink-2">{t.newReel.whereSellHint}</p>
              <div className="clear-both mt-2 grid grid-cols-2 gap-2 pt-1">
                {REGIONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => chooseRegion(r)} className={btn.glass}>
                    {t.regions[r.value]}
                  </button>
                ))}
              </div>
              {regionError && <p role="alert" className="mt-1 text-[13px] text-loss">{regionError}</p>}
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-3 flex items-center gap-1.5 text-2xl font-black text-ink"><Languages className="h-5 w-5 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.language}</legend>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={lang === l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`min-h-14 rounded-[16px] text-sm transition ${lang === l.value ? "bg-charcoal text-white" : "glass text-ink"}`}
                >
                  <span className="block font-medium">{l.native}</span>
                  {l.native !== l.label && <span className="block text-xs opacity-75">{l.label}</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 flex items-center gap-1.5 text-2xl font-black text-ink"><Palette className="h-5 w-5 text-ember-400" strokeWidth={1.5} aria-hidden /> {t.newReel.style}</legend>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  aria-pressed={templateId === tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-[18px] p-1 transition ${templateId === tpl.id ? "ring-2 ring-ember-400" : ""}`}
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
        <div role="alert" className="rounded-[16px] bg-loss/10 p-4 text-[15px] text-loss">
          {error.message}
          {error.limit && <Link href="/pricing" className="mt-2 block font-bold underline">{t.newReel.seePlan}</Link>}
        </div>
      )}

      {/* Stays above the floating nav (and its raised red button) so Next is always in reach on a long list. */}
      <div className="sticky bottom-[calc(6.75rem+env(safe-area-inset-bottom))] rounded-[24px] z-10 -mx-5 flex gap-3 border-t border-sage/30 bg-canvas/80 px-5 py-3 backdrop-blur-xl">
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className={btn.glass}>
            {t.common.back}
          </button>
        )}
        {/* Separate keys: reusing one element would turn "Next" into the submit button mid-click and skip step 3. */}
        {step < STEPS.length ? (
          <button key="next" type="button" onClick={next} disabled={uploading} className={`${btn.light} flex-1`}>
            {uploading ? t.newReel.uploadingPhotos : `${t.common.next} →`}
          </button>
        ) : (
          <button key="generate" disabled={busy || outOfReels || uploading || !me} className={`${btn.light} flex-1`}>
            {busy ? t.newReel.starting : outOfReels ? t.newReel.noneLeft : t.newReel.generate}
          </button>
        )}
      </div>
      {step === STEPS.length && outOfReels && (
        <Link href="/pricing" className="-mt-3 text-center text-[15px] font-medium text-ember-300">{t.newReel.getUnlimited99}</Link>
      )}
      {step === STEPS.length && !outOfReels && <p className="-mt-3 text-center text-xs text-ink-2">{t.newReel.takes}</p>}
    </form>
  );
}
