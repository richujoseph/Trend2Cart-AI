"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clapperboard, Flame, Search, Star, Store, Trophy, TrendingDown, TrendingUp, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Trending } from "@/lib/discover";
import { fmt, messagesNow, useT } from "@/lib/i18n";
import { CATEGORIES, type Category, type ProductListItem, formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, ErrorState, LossTrapTag, ProductImage, ScoreBadge } from "@/components/states";
import { ChangeBadge, PageHero, SectionTitle, Sparkline, card, chip } from "@/components/ui";

type Filter = Category | "saved" | "mine" | null;
const SORTS = ["score", "profit", "trend", "competition"] as const;
type Sort = (typeof SORTS)[number];

export default function ProductsPage() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>(null);
  const [sort, setSort] = useState<Sort>("score");
  const [attempt, setAttempt] = useState(0);
  // Keyed by what was requested, so switching filters shows the skeleton without resetting state in an effect.
  const [result, setResult] = useState<{ key: string; items?: ProductListItem[]; error?: string } | null>(null);
  const key = `${filter ?? "all"}|${sort}|${attempt}`;

  useEffect(() => {
    let stale = false; // ignore a slow response after the seller switched filter
    const category = filter && filter !== "saved" && filter !== "mine" ? `&category=${filter}` : "";
    const all = apiFetch<ProductListItem[]>(`/products?sort=${sort}${category}`);
    const load =
      filter === "saved"
        ? Promise.all([all, savedIds()]).then(([items, ids]) => items.filter((p) => ids.has(p.id)))
        : filter === "mine"
          ? all.then((items) => items.filter((p) => p.mine))
          : all;
    load
      .then((items) => !stale && setResult({ key, items }))
      .catch((e: Error) => !stale && setResult({ key, error: e.message }));
    return () => {
      stale = true;
    };
  }, [filter, sort, key]);

  const current = result?.key === key ? result : null;
  const items = current?.items ?? null;
  const error = current?.error ?? null;
  const retry = () => setAttempt((a) => a + 1);
  // Spotlight only on the unfiltered "best overall" view, so it's the real number one.
  const spotlight = filter === null && sort === "score" ? items?.find((p) => !p.loss_trap && p.score !== null) : undefined;
  const rest = items?.filter((p) => p !== spotlight) ?? null;
  const winners = items?.filter((p) => p.profit_paise > 0).length ?? 0;

  return (
    <>
      <PageHero title={t.products.title} subtitle={t.products.subtitle}>
        <SearchBox />
        {filter === null && items && (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/85">
            <span>{fmt(t.products.statChecked, { n: items.length })}</span>
            <span>· {fmt(t.products.statWinning, { n: winners })}</span>
            <span>· {t.products.statReal}</span>
          </p>
        )}
      </PageHero>

      <TrendingStrip />

      {spotlight && <Spotlight p={spotlight} />}

      <div className="mt-7">
        <SectionTitle icon={Store} title={t.products.catalogTitle} subtitle={t.products.catalogSub} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <button onClick={() => setFilter(null)} aria-pressed={filter === null} className={chip(filter === null)}>{t.products.all}</button>
        <button onClick={() => setFilter("mine")} aria-pressed={filter === "mine"} className={chip(filter === "mine")}>{t.products.mine}</button>
        <button onClick={() => setFilter("saved")} aria-pressed={filter === "saved"} className={chip(filter === "saved")}>{t.products.saved}</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c} className={chip(filter === c)}>
            {t.categories[c]}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-neutral-600">{t.products.sortLabel}</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-brand-800 outline-none ring-1 ring-brand-100"
        >
          {SORTS.map((s) => <option key={s} value={s}>{t.products.sorts[s]}</option>)}
        </select>
      </label>

      {error && <ErrorState message={error} onRetry={retry} />}
      {!items && !error && <GridSkeleton />}
      {items?.length === 0 && filter === "saved" && <EmptyState icon={Star} title={t.products.noSavedTitle} body={t.products.noSavedBody} />}
      {items?.length === 0 && filter === "mine" && <EmptyState icon={Store} title={t.products.noMineTitle} body={t.products.noMineBody} />}
      {items?.length === 0 && filter !== "saved" && filter !== "mine" && <EmptyState title={t.products.noneTitle} body={t.products.noneBody} />}
      {rest && rest.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {rest.map((p, i) => (
            <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
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
      <Search aria-hidden className="h-5 w-5 shrink-0 text-brand-500" />
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

function Spotlight({ p }: { p: ProductListItem }) {
  const { t } = useT();
  const margin = Math.round((p.profit_paise / p.selling_price_paise) * 100);
  return (
    <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-lg shadow-brand-900/10 ring-1 ring-brand-900/5 animate-rise">
      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-4 py-2 text-sm font-bold text-white">
        <Trophy className="h-4 w-4" aria-hidden /> {t.products.topPick}
        <span className="ml-auto text-xs font-medium text-white/90">{t.products.topPickWhy}</span>
      </div>
      <Link href={`/products/${p.id}`} className="flex gap-4 p-4">
        <ProductImage src={p.image_urls[0]} name={p.name} className="h-28 w-28 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">{t.categories[p.category]}</p>
          <h2 className="line-clamp-2 text-lg font-extrabold leading-tight text-brand-900">{p.name}</h2>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600">
            {formatRupees(p.profit_paise)}
            <span className="ml-1 text-xs font-medium text-neutral-500">{t.products.profitPerOrder}</span>
          </p>
          <Signals p={p} margin={margin} />
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-2 border-t border-brand-50 p-3">
        <Link href={`/products/${p.id}`} className="flex h-11 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-800">
          {t.products.view}
        </Link>
        <Link href={`/reels/new?product=${p.id}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-fuchsia-600 text-sm font-bold text-white">
          <Clapperboard className="h-4 w-4" aria-hidden /> {t.product.makeReel}
        </Link>
      </div>
    </section>
  );
}

/** Margin, search trend and competition as small readable signals. */
function Signals({ p, margin }: { p: ProductListItem; margin: number }) {
  const { t } = useT();
  const comp = p.competition_score;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
      <span className={`rounded-full px-2 py-0.5 ${margin > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
        {fmt(t.products.margin, { pct: margin })}
      </span>
      {p.trend_score !== null && (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 ${p.trend_score >= 50 ? "bg-sky-50 text-sky-700" : "bg-neutral-100 text-neutral-600"}`}>
          {p.trend_score >= 50 ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
          {t.products.searches} {p.trend_score}
        </span>
      )}
      {comp !== null && (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 ${comp >= 60 ? "bg-red-50 text-red-700" : comp >= 30 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <Users className="h-3 w-3" aria-hidden />
          {comp >= 60 ? t.search.compHigh : comp >= 30 ? t.search.compMedium : t.search.compLow}
        </span>
      )}
    </div>
  );
}

function TrendingStrip() {
  const { t } = useT();
  const [data, setData] = useState<Trending | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      apiFetch<Trending>("/discover/trending")
        .then((d) => {
          if (stale) return;
          setData(d);
          // The very first check runs in the background; look again a few times, then stop.
          if (!d.items.length && d.refreshing && ++tries < 5) timer = setTimeout(load, 15000);
          else if (!d.items.length) setFailed(true);
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
      <SectionTitle icon={Flame} title={t.products.trendingTitle} subtitle={t.products.trendingSub} />
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
          {data.items.slice(0, 12).map((item, i) => (
            <li key={item.term} className="snap-start">
              <Link
                href={`/products/search?q=${encodeURIComponent(item.term)}`}
                className={`${card} flex h-[108px] w-40 flex-col justify-between p-3 transition active:scale-[.98]`}
              >
                <div>
                  <p className="flex items-center gap-1 text-[10px] font-bold text-orange-600">#{i + 1}</p>
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
  const margin = Math.round((p.profit_paise / p.selling_price_paise) * 100);
  return (
    <Link href={`/products/${p.id}`} className={`${card} flex h-full flex-col overflow-hidden transition active:scale-[.98]`}>
      <div className="relative">
        <ProductImage src={p.image_urls[0]} name={p.name} className="aspect-square w-full" />
        <span className="absolute right-2 top-2"><ScoreBadge score={p.score} /></span>
        {p.mine && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white shadow">{t.products.yours}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">{t.categories[p.category]}</p>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">{p.name}</h3>
        <p className={`mt-auto pt-1 text-lg font-extrabold tabular-nums ${losing ? "text-red-600" : "text-emerald-700"}`}>
          {formatRupees(p.profit_paise)}
          <span className="ml-0.5 text-[10px] font-medium text-neutral-500">{t.common.perOrder}</span>
        </p>
        <p className="text-[11px] text-neutral-500">
          {fmt(t.products.sellsAt, { price: formatRupees(p.selling_price_paise) })} · {fmt(t.products.margin, { pct: margin })}
        </p>
        {p.loss_trap && <span className="mt-1"><LossTrapTag /></span>}
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={`${card} animate-pulse overflow-hidden`}>
          <div className="aspect-square bg-brand-50" />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-1/3 rounded bg-brand-50" />
            <div className="h-4 w-3/4 rounded bg-brand-50" />
            <div className="h-5 w-1/2 rounded bg-brand-50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
