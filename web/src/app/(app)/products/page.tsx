"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Trending } from "@/lib/discover";
import { fmt, messagesNow, useT } from "@/lib/i18n";
import { CATEGORIES, type Category, type ProductListItem, formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, ErrorState, LossTrapTag, ProductImage, ScoreBadge } from "@/components/states";
import { ChangeBadge, PageHero, SectionTitle, Sparkline, card, chip } from "@/components/ui";

export default function ProductsPage() {
  const { t } = useT();
  // null = all products; "saved" = only the seller's saved products.
  const [category, setCategory] = useState<Category | "saved" | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Keyed by what was requested, so switching category shows the skeleton without resetting state in an effect.
  const [result, setResult] = useState<{ key: string; items?: ProductListItem[]; error?: string } | null>(null);
  const key = `${category ?? "all"}|${attempt}`;

  useEffect(() => {
    let stale = false; // ignore a slow response after the seller switched category
    const load =
      category === "saved"
        ? Promise.all([apiFetch<ProductListItem[]>("/products?sort=score"), savedIds()]).then(([all, ids]) =>
            all.filter((p) => ids.has(p.id)),
          )
        : apiFetch<ProductListItem[]>(`/products?sort=score${category ? `&category=${category}` : ""}`);
    load
      .then((items) => !stale && setResult({ key, items }))
      .catch((e: Error) => !stale && setResult({ key, error: e.message }));
    return () => {
      stale = true;
    };
  }, [category, key]);

  const current = result?.key === key ? result : null;
  const items = current?.items ?? null;
  const error = current?.error ?? null;
  const retry = () => setAttempt((a) => a + 1);

  return (
    <>
      <PageHero title={t.products.title} subtitle={t.products.subtitle}>
        <SearchBox />
      </PageHero>

      <TrendingStrip />

      <div className="mt-7">
        <SectionTitle title={t.products.catalogTitle} subtitle={t.products.catalogSub} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <button onClick={() => setCategory(null)} aria-pressed={category === null} className={chip(category === null)}>{t.products.all}</button>
        <button onClick={() => setCategory("saved")} aria-pressed={category === "saved"} className={chip(category === "saved")}>{t.products.saved}</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} aria-pressed={category === c} className={chip(category === c)}>
            {t.categories[c]}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={retry} />}
      {!items && !error && <ListSkeleton />}
      {items?.length === 0 && category === "saved" && <EmptyState icon="☆" title={t.products.noSavedTitle} body={t.products.noSavedBody} />}
      {items?.length === 0 && category !== "saved" && <EmptyState title={t.products.noneTitle} body={t.products.noneBody} />}
      {items && items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((p, i) => (
            <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SearchBox() {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 3) router.push(`/products/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-white p-1.5 pl-3 shadow-lg shadow-brand-900/20"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={60}
        placeholder={t.products.searchPlaceholder}
        aria-label={t.products.searchPlaceholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
      />
      <button disabled={q.trim().length < 3} className="h-9 shrink-0 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 px-4 text-sm font-bold text-white disabled:opacity-40">
        {t.products.search}
      </button>
    </form>
  );
}

function TrendingStrip() {
  const { t } = useT();
  const [data, setData] = useState<Trending | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      apiFetch<Trending>("/discover/trending")
        .then((d) => {
          if (stale) return;
          setData(d);
          if (!d.items.length && d.refreshing) timer = setTimeout(load, 15000); // first-ever check runs in the background
        })
        .catch(() => !stale && setFailed(true));
    load();
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <section className="mt-6">
      <SectionTitle title={`🔥 ${t.products.trendingTitle}`} subtitle={t.products.trendingSub} />
      {failed && <p className="mt-2 text-sm text-neutral-500">{t.products.trendingEmpty}</p>}
      {!failed && !data?.items.length && (
        <div className="-mx-4 mt-3 flex gap-3 overflow-hidden px-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-[108px] w-40 shrink-0 animate-pulse rounded-2xl bg-white/70" />)}
        </div>
      )}
      {!failed && data && !data.items.length && data.refreshing && (
        <p className="mt-2 text-xs text-neutral-500">{t.products.trendingLoading}</p>
      )}
      {!!data?.items.length && (
        <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {data.items.slice(0, 12).map((item) => (
            <li key={item.term} className="snap-start">
              <Link
                href={`/products/search?q=${encodeURIComponent(item.term)}`}
                className={`${card} flex h-[108px] w-40 flex-col justify-between p-3 transition active:scale-[.98]`}
              >
                <div>
                  <p className="line-clamp-1 font-bold capitalize text-brand-900">{item.term}</p>
                  {item.category && <p className="text-[11px] text-neutral-500">{t.categories[item.category]}</p>}
                </div>
                <div className="flex items-end justify-between gap-1">
                  <ChangeBadge pct={item.change_pct} />
                  <Sparkline points={item.weekly} className="h-7 w-16" tone={item.change_pct >= 0 ? "#059669" : "#dc2626"} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function savedIds(): Promise<Set<string>> {
  const { data, error } = await createClient().from("saved_products").select("product_id");
  if (error) throw new Error(messagesNow().products.savedError);
  return new Set(data.map((row) => row.product_id as string));
}

function ProductCard({ product: p }: { product: ProductListItem }) {
  const { t } = useT();
  const losing = p.profit_paise <= 0;
  return (
    <Link href={`/products/${p.id}`} className={`${card} flex gap-3 p-3 transition active:scale-[.99]`}>
      <ProductImage src={p.image_urls[0]} name={p.name} className="h-24 w-24 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{t.categories[p.category]}</p>
            <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">{p.name}</h3>
          </div>
          <ScoreBadge score={p.score} />
        </div>
        <p className={`mt-auto text-xl font-extrabold tabular-nums ${losing ? "text-red-600" : "text-emerald-700"}`}>
          {formatRupees(p.profit_paise)}
          <span className="ml-1 text-xs font-medium text-neutral-500">{t.products.profitPerOrder}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>{fmt(t.products.sellsAt, { price: formatRupees(p.selling_price_paise) })}</span>
          {p.loss_trap && <LossTrapTag />}
        </div>
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-3 flex flex-col gap-3" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={`${card} flex animate-pulse gap-3 p-3`}>
          <div className="h-24 w-24 rounded-xl bg-brand-50" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 rounded bg-brand-50" />
            <div className="h-4 w-3/4 rounded bg-brand-50" />
            <div className="mt-auto h-6 w-1/2 rounded bg-brand-50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
