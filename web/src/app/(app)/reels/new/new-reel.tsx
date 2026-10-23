"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { type ProductListItem, formatRupees } from "@/lib/products";
import { LANGUAGES, type Language, type Me, TEMPLATES, reelsLeftText } from "@/lib/reels";
import { ErrorState } from "@/components/states";

const AUDIENCE_IDEAS = ["college girls in Kochi", "working women in Thiruvananthapuram", "young moms in Chennai", "students in Coimbatore"];

export default function NewReel() {
  const router = useRouter();
  const preselected = useSearchParams().get("product");
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productId, setProductId] = useState(preselected ?? "");
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState<Language | null>(null);
  const [templateId, setTemplateId] = useState(1);
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

  const lang = language ?? me?.profile.language ?? "ml";
  const product = products?.find((p) => p.id === productId);
  const outOfReels = me?.reels.left === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return setError({ message: "Pick a product for your Reel.", limit: false });
    if (audience.trim().length < 3) {
      return setError({ message: "Describe who the Reel is for, for example \"college girls in Kochi\".", limit: false });
    }
    setBusy(true);
    setError(null);
    try {
      const reel = await apiFetch<{ id: string }>("/reels", {
        method: "POST",
        body: JSON.stringify({ product_id: productId, audience: audience.trim(), language: lang, template_id: templateId }),
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
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div>
        <Link href="/reels" className="text-sm text-neutral-600">← Your Reels</Link>
        <h1 className="mt-2 text-xl font-bold">Make a Reel</h1>
        {me && <p className="mt-1 text-sm text-neutral-600">{reelsLeftText(me)}</p>}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Product</span>
        {products ? (
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-12 rounded-lg border border-neutral-300 bg-white px-3"
          >
            <option value="">Choose a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatRupees(p.selling_price_paise)}
              </option>
            ))}
          </select>
        ) : (
          <div className="h-12 animate-pulse rounded-lg bg-neutral-200" />
        )}
        {product?.loss_trap && (
          <span className="text-xs text-red-700">⚠ This product loses money at its usual price. Check its profit first.</span>
        )}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Who is it for?</span>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          maxLength={80}
          placeholder="e.g. college girls in Kochi"
          className="h-12 rounded-lg border border-neutral-300 bg-white px-3"
        />
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setAudience(idea)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700">
              {idea}
            </button>
          ))}
        </div>
      </label>

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

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error.message}
          {error.limit && (
            <Link href="/pricing" className="mt-2 block font-semibold underline">See the founding plan →</Link>
          )}
        </div>
      )}

      <button disabled={busy || outOfReels} className="h-12 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
        {busy ? "Starting…" : outOfReels ? "No free Reels left this month" : "Make my Reel"}
      </button>
      {outOfReels && (
        <Link href="/pricing" className="-mt-3 text-center text-sm font-semibold underline">Get unlimited Reels →</Link>
      )}
      <p className="-mt-3 text-center text-xs text-neutral-500">Takes about a minute. You can leave this page.</p>
    </form>
  );
}
