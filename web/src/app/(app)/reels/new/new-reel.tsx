"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type ProductListItem, formatRupees } from "@/lib/products";
import { LANGUAGES, type Language, type Me, REGIONS, TEMPLATES } from "@/lib/reels";
import { saveProfile } from "@/lib/profile";
import { ErrorState, LossTrapTag, ProductImage } from "@/components/states";
import QuotaLine from "@/components/quota-line";
import { deleteSellerPhoto, uploadSellerPhoto } from "@/lib/photos";

const MAX_PHOTOS = 4;
const STEPS = ["Product", "Audience", "Language & style"];
const AUDIENCE_IDEAS = ["college girls in Kochi", "working women in Thiruvananthapuram", "young moms in Chennai", "students in Coimbatore"];

export default function NewReel() {
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

  // A seller's chosen language wins; otherwise their saved default (set from their region).
  const lang = language ?? me?.profile.language ?? "ml";
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
      setLanguage(null);
    } catch (err) {
      setRegionError((err as Error).message);
    }
  }

  function next() {
    setError(null);
    if (step === 1 && !productId) return setError({ message: "Pick a product for your Reel.", limit: false });
    if (step === 2 && audience.trim().length < 3) {
      return setError({ message: "Describe who the Reel is for, for example \"college girls in Kochi\".", limit: false });
    }
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
        <Link href="/reels" className="text-sm text-neutral-600">← Your Reels</Link>
        <h1 className="mt-2 text-xl font-bold">Make a Reel</h1>
        {me && <QuotaLine me={me} />}
      </div>

      {outOfReels && (
        <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          You&apos;ve used all your free Reels this month. You can still set one up and make it once your Reels reset.
          <Link href="/pricing" className="mt-1 block font-semibold underline">Get unlimited Reels for ₹99 →</Link>
        </div>
      )}

      <ol className="grid grid-cols-3 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              <button
                type="button"
                disabled={n >= step}
                onClick={() => setStep(n)}
                className="w-full text-left disabled:cursor-default"
              >
                <span className={`block h-1.5 rounded-full ${state === "todo" ? "bg-neutral-200" : "bg-neutral-900"}`} />
                <span className={`mt-1 block text-xs ${state === "current" ? "font-semibold text-neutral-900" : "text-neutral-500"}`}>
                  {n}. {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {step > 1 && product && (
        <div className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-neutral-200">
          <ProductImage src={photos[0]?.preview ?? product.image_urls[0]} name={product.name} className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{product.name}</p>
            <p className="text-xs text-neutral-500">
              {formatRupees(product.selling_price_paise)}
              {photos.length > 0 && ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
              {step > 2 && audience && ` · for ${audience.trim()}`}
            </p>
          </div>
          <button type="button" onClick={() => setStep(1)} className="shrink-0 px-2 text-sm font-medium underline">Change</button>
        </div>
      )}

      {step === 1 && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Which product is the Reel for?</legend>
            {products ? (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white p-2 ${productId === p.id ? "border-neutral-900" : "border-transparent ring-1 ring-neutral-200"}`}
                  >
                    <input type="radio" name="product" value={p.id} checked={productId === p.id} onChange={() => setProductId(p.id)} className="sr-only" />
                    <ProductImage src={p.image_urls[0]} name={p.name} className="h-14 w-14 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-neutral-500">
                        Sells at {formatRupees(p.selling_price_paise)} · {p.profit_paise >= 0 ? "profit" : "loss"} {formatRupees(Math.abs(p.profit_paise))}/order
                      </span>
                      {p.loss_trap && <span className="mt-1 block"><LossTrapTag /></span>}
                    </span>
                    {productId === p.id && <span className="shrink-0 text-lg" aria-hidden>✓</span>}
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl bg-neutral-200" />)}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Your photos <span className="font-normal text-neutral-500">(recommended)</span></span>
            <p className="text-xs text-neutral-500">
              Clear photos of the real product look far better than store thumbnails. Up to {MAX_PHOTOS}.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="Your product photo" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.path)}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-xs text-neutral-500">
                  <span className="text-2xl leading-none">{uploading ? "…" : "+"}</span>
                  {uploading ? "Uploading" : "Add"}
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
            {photos.length === 0 && <p className="text-xs text-neutral-500">No photos? We&apos;ll use the product&apos;s market photo.</p>}
            {photoError && <p role="alert" className="text-xs text-red-700">{photoError}</p>}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Who is it for?</span>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              maxLength={80}
              placeholder="e.g. college girls in Kochi"
              className="h-12 rounded-lg border border-neutral-300 bg-white px-3"
            />
            <span className="text-xs text-neutral-500">Who and where. The script speaks to them directly.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                aria-pressed={audience === idea}
                onClick={() => setAudience(idea)}
                className={`rounded-full border px-3 py-1.5 text-xs ${audience === idea ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"}`}
              >
                {idea}
              </button>
            ))}
          </div>
          {hook && (
            <div className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm">
              <span>
                <span className="block text-xs font-medium text-amber-900">Opening line (from Conversion Doctor)</span>
                “{hook}”
              </span>
              <button type="button" onClick={() => setHook("")} aria-label="Remove opening line" className="shrink-0 text-amber-900">
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {step === 3 && me && (
        <>
          {!me.profile.region && (
            <fieldset className="rounded-xl bg-white p-3 ring-1 ring-neutral-200">
              <legend className="float-left w-full text-sm font-medium">Where do you sell?</legend>
              <p className="text-xs text-neutral-500">We&apos;ll pick the right language for your Reels. Change it any time in Account.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {REGIONS.map((r) => (
                  <button key={r.value} type="button" onClick={() => chooseRegion(r)} className="h-11 rounded-lg border border-neutral-300 bg-white text-sm font-medium">
                    {r.label}
                  </button>
                ))}
              </div>
              {regionError && <p role="alert" className="mt-1 text-xs text-red-700">{regionError}</p>}
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Language</legend>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={lang === l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`h-14 rounded-lg border text-sm ${lang === l.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}
                >
                  <span className="block font-semibold">{l.native}</span>
                  {l.native !== l.label && <span className="block text-xs opacity-75">{l.label}</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Style</legend>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={templateId === t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`rounded-lg border-2 p-1 ${templateId === t.id ? "border-neutral-900" : "border-transparent"}`}
                >
                  <div className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-md" style={{ background: t.bg }}>
                    <span className="absolute left-1/2 top-[12%] -translate-x-1/2 rounded px-1 text-[10px] font-bold" style={{ background: t.accent, color: t.bg }}>
                      ₹
                    </span>
                    <span className="absolute inset-x-2 bottom-[22%] h-1.5 rounded" style={{ background: t.text }} />
                    <span className="absolute inset-x-4 bottom-[17%] h-1.5 rounded" style={{ background: t.text }} />
                  </div>
                  <span className="mt-1 block text-xs">{t.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error.message}
          {error.limit && (
            <Link href="/pricing" className="mt-2 block font-semibold underline">See the founding plan →</Link>
          )}
        </div>
      )}

      {/* Stays above the bottom nav so Next is always in reach on a long product list. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 bg-neutral-50/95 px-4 py-3 backdrop-blur">
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="h-12 rounded-lg border border-neutral-300 bg-white px-5 font-medium">
            Back
          </button>
        )}
        {/* Separate keys: reusing one element would turn "Next" into the submit button mid-click and skip step 3. */}
        {step < STEPS.length ? (
          <button key="next" type="button" onClick={next} disabled={uploading} className="h-12 flex-1 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
            {uploading ? "Uploading photos…" : "Next"}
          </button>
        ) : (
          <button key="generate" disabled={busy || outOfReels || uploading || !me} className="h-12 flex-1 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
            {busy ? "Starting…" : outOfReels ? "No free Reels left this month" : "Generate my Reel"}
          </button>
        )}
      </div>
      {step === STEPS.length && outOfReels && (
        <Link href="/pricing" className="-mt-3 text-center text-sm font-semibold underline">Get unlimited Reels →</Link>
      )}
      {step === STEPS.length && !outOfReels && (
        <p className="-mt-3 text-center text-xs text-neutral-500">Takes under a minute. You can leave this page.</p>
      )}
    </form>
  );
}
