"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRight, Clapperboard, Dumbbell, Flame, House, IndianRupee, Info, LayoutGrid, Percent, Search, Smartphone,
  Sparkles, Star, Store, Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Trending } from "@/lib/discover";
import { fmt, messagesNow, useT } from "@/lib/i18n";
import { CATEGORIES, type Category, type ProductListItem, formatRupees, formatRupeesWhole } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, ErrorState, LossTrapTag, ProductImage } from "@/components/states";
import { BentoMetric, ChangeBadge, RibbonBackground, SectionTitle, Sparkline, btn, card } from "@/components/ui";

type Filter = Category | "saved" | "mine" | null;
const SORTS = ["score", "profit", "trend", "competition"] as const;
type Sort = (typeof SORTS)[number];
const CATEGORY_ICON: Record<Category, LucideIcon> = { home_gadgets: House, beauty: Sparkles, phone_accessories: Smartphone, fitness: Dumbbell };

export default function ProductsPage() {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>(null);
  const [sort, setSort] = useState<Sort>("score");
  const [attempt, setAttempt] = useState(0);
  // Keyed by what was requested, so switching filters shows the skeleton without resetting state in an effect.
  const [result, setResult] = useState<{ key: string; items?: ProductListItem[]; error?: string } | null>(null);
  const [counts, setCounts] = useState<{ all: ProductListItem[]; saved: Set<string> } | null>(null);
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

  // Counts for the selector (one extra read; the list above stays the source of what's shown).
  useEffect(() => {
    Promise.all([apiFetch<ProductListItem[]>("/products?sort=score"), savedIds()])
      .then(([all, saved]) => setCounts({ all, saved }))
      .catch(() => {});
  }, [attempt]);

  const current = result?.key === key ? result : null;
  const items = current?.items ?? null;
  const error = current?.error ?? null;
  const retry = () => setAttempt((a) => a + 1);
  // Spotlight only on the unfiltered "best overall" view, so it's the real number one.
  const spotlight = filter === null && sort === "score" ? items?.find((p) => !p.loss_trap && p.score !== null) : undefined;
  const rest = items?.filter((p) => p !== spotlight) ?? null;
  const winners = counts?.all.filter((p) => p.profit_paise > 0).length ?? 0;

  const selector: { value: Filter; label: string; icon: LucideIcon; count?: number }[] = [
    { value: null, label: t.products.all, icon: LayoutGrid, count: counts?.all.length },
    { value: "mine", label: t.products.mine, icon: Store, count: counts?.all.filter((p) => p.mine).length },
    { value: "saved", label: t.products.saved.replace("★ ", ""), icon: Star, count: counts?.saved.size },
    ...CATEGORIES.map((c) => ({ value: c as Filter, label: t.categories[c], icon: CATEGORY_ICON[c], count: counts?.all.filter((p) => p.category === c).length })),
  ];

  return (
    <>
      <h1 className="text-[32px] font-black leading-[1.1] text-charcoal">{t.products.title}</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{t.products.subtitle}</p>
      <SearchBox />
      {counts && (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {fmt(t.products.statChecked, { n: counts.all.length })} · {fmt(t.products.statWinning, { n: winners })} · {t.products.statReal}
        </p>
      )}

      <ul className="-mx-5 mt-5 flex snap-x items-center gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]" aria-label={t.products.catalogTitle}>
        {selector.map(({ value, label, icon: Icon, count }) => {
          const active = filter === value;
          return (
            <li key={value ?? "all"} className="snap-start">
              <button
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={active}
                aria-label={label}
                className={
                  active
                    ? "flex h-14 w-40 items-center gap-2.5 rounded-full bg-charcoal pl-2 pr-4 text-left text-white transition"
                    : "flex h-14 w-14 items-center justify-center rounded-[16px] border border-sage/30 bg-white text-charcoal transition hover:border-charcoal"
                }
              >
                {active ? (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red text-sm font-black tabular-nums">{count ?? "–"}</span>
                    <span className="line-clamp-2 text-[13px] font-bold leading-tight">{label}</span>
                  </>
                ) : (
                  <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {spotlight && <Spotlight p={spotlight} />}

      <TrendingStrip />

      <div className="mt-8">
        <SectionTitle
          subtitle={t.products.catalogSub}
          title={t.products.catalogTitle}
          aside={
            <label className="shrink-0">
              <span className="sr-only">{t.products.sortLabel}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-10 rounded-full border border-sage/50 bg-white px-3 text-sm font-bold text-charcoal outline-none"
              >
                {SORTS.map((s) => <option key={s} value={s}>{t.products.sorts[s]}</option>)}
              </select>
            </label>
          }
        />
      </div>

      {error && <ErrorState message={error} onRetry={retry} />}
      {!items && !error && <FeedSkeleton />}
      {items?.length === 0 && filter === "saved" && <EmptyState icon={Star} title={t.products.noSavedTitle} body={t.products.noSavedBody} />}
      {items?.length === 0 && filter === "mine" && <EmptyState icon={Store} title={t.products.noMineTitle} body={t.products.noMineBody} />}
      {items?.length === 0 && filter !== "saved" && filter !== "mine" && <EmptyState title={t.products.noneTitle} body={t.products.noneBody} />}
      {rest && rest.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {rest.map((p, i) => (
            <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <FeedItem product={p} />
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
      className="mt-5 flex h-14 items-center gap-2 rounded-full border border-sage/40 bg-white p-1.5 pl-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]"
    >
      <Search aria-hidden className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={2.2} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={60}
        placeholder={t.products.searchPlaceholder}
        aria-label={t.products.searchPlaceholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-charcoal outline-none placeholder:font-normal placeholder:text-ink-3"
      />
      <button disabled={q.trim().length < 3} className="h-11 shrink-0 rounded-full bg-red px-5 text-sm font-extrabold text-white disabled:opacity-40">
        {t.products.search}
      </button>
    </form>
  );
}

/** Hero feature card: the best product right now, with bento metrics and a plain-language note. */
function Spotlight({ p }: { p: ProductListItem }) {
  const { t } = useT();
  const margin = Math.round((p.profit_paise / p.selling_price_paise) * 100);
  const comp = p.competition_score;
  const note = comp !== null && comp >= 60 ? t.products.noteCompetition : p.trend_score !== null && p.trend_score >= 50 ? t.products.noteRising : t.products.noteSteady;
  return (
    <section className={`${card} relative isolate mt-6 overflow-hidden p-6 animate-rise`}>
      <RibbonBackground variant="section" className="-z-10" />
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-white p-1.5 shadow-md ring-1 ring-sage/30">
          <ProductImage src={p.image_urls[0]} name={p.name} className="h-full w-full rounded-[14px]" />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
          <Trophy className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden /> {t.products.topPick}
        </span>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">{t.categories[p.category]} · {t.products.topPickWhy}</p>
      <h2 className="mt-1 text-xl font-black leading-snug text-charcoal">{p.name}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <BentoMetric label={t.products.profitPerOrder} value={formatRupeesWhole(p.profit_paise)} icon={IndianRupee} />
        <BentoMetric label={t.product.marginLabel} value={`${margin}%`} icon={Percent} />
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-[16px] bg-sage/20 p-3 text-[13px] font-semibold leading-snug text-charcoal">
        <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden /> {note}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Link href={`/reels/new?product=${p.id}`} className={btn.light}>
          <Clapperboard className="h-4 w-4" strokeWidth={2.2} aria-hidden /> {t.product.makeReel}
        </Link>
        <Link href={`/products/${p.id}`} className={btn.glass}>{t.products.view}</Link>
      </div>
    </section>
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
    <section className="mt-8">
      <SectionTitle icon={Flame} subtitle={t.products.trendingSub} title={t.products.trendingTitle} />
      {failed && <p className="mt-2 text-sm text-ink-2">{t.products.trendingEmpty}</p>}
      {!failed && !data?.items.length && (
        <div className="-mx-5 mt-3 flex gap-3 overflow-hidden px-5">
          {[0, 1].map((i) => <div key={i} className="skeleton-light h-36 w-[78%] shrink-0 rounded-[24px]" />)}
        </div>
      )}
      {!failed && data && !data.items.length && data.refreshing && (
        <p className="mt-2 text-xs text-ink-2">{t.products.trendingLoading}</p>
      )}
      {!!data?.items.length && (
        <ul className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          {data.items.slice(0, 12).map((item, i) => (
            <li key={item.term} className="w-[78%] shrink-0 snap-start">
              <Link
                href={`/products/search?q=${encodeURIComponent(item.term)}`}
                className="flex h-full flex-col rounded-[24px] border border-sage/30 bg-white p-5 transition hover:border-charcoal"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  #{i + 1}{item.category && ` · ${t.categories[item.category]}`}
                </p>
                <p className="mt-1 line-clamp-2 text-xl font-black capitalize leading-snug text-charcoal">{item.term}</p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <ChangeBadge pct={item.change_pct} />
                  <Sparkline points={item.weekly} className="h-10 w-full max-w-[60%]" tone={item.change_pct >= 0 ? "#1f7a46" : "#ca0013"} />
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

/** Secondary feed item: 24px white card, 56px image holder, bold name, trailing round button. */
function FeedItem({ product: p }: { product: ProductListItem }) {
  const { t } = useT();
  const losing = p.profit_paise <= 0;
  const margin = Math.round((p.profit_paise / p.selling_price_paise) * 100);
  return (
    <Link href={`/products/${p.id}`} className="group flex items-center gap-3 rounded-[24px] border border-sage/30 bg-white p-3 pr-4 transition hover:border-charcoal">
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-sage/10 p-1">
        <ProductImage src={p.image_urls[0]} name={p.name} className="h-full w-full rounded-[12px]" />
        {p.score !== null && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-charcoal px-1 text-[10px] font-black tabular-nums text-white">
            {p.score}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t.categories[p.category]}{p.mine && ` · ${t.products.yours}`}
        </span>
        <span className="block text-lg font-black leading-snug text-charcoal">{p.name}</span>
        <span className="mt-0.5 block text-[13px] font-semibold text-ink-2">
          <b className={`font-black tabular-nums ${losing ? "text-red" : "text-profit"}`}>{formatRupeesWhole(p.profit_paise)}</b>
          {t.common.perOrder} · {fmt(t.products.sellsAt, { price: formatRupees(p.selling_price_paise) })} · {fmt(t.products.margin, { pct: margin })}
        </span>
        {p.loss_trap && <span className="mt-1.5 block"><LossTrapTag /></span>}
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sage/50 text-charcoal transition group-hover:border-red group-hover:bg-red group-hover:text-white" aria-hidden>
        <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
      </span>
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <ul className="mt-4 flex flex-col gap-3" aria-busy>
      {[0, 1, 2, 3].map((i) => <li key={i} className="skeleton-light h-[88px] rounded-[24px]" />)}
    </ul>
  );
}
