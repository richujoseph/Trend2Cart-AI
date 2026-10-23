"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CATEGORIES, type Category, type ProductListItem, formatRupees } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, ErrorState, LossTrapTag, ProductImage, ScoreBadge } from "@/components/states";

export default function ProductsPage() {
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
      <h1 className="text-xl font-bold">Products</h1>
      <p className="mt-1 text-sm text-neutral-600">Ranked by expected profit per order, after returns, fees and ads.</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={category === null} onClick={() => setCategory(null)}>All</Chip>
        <Chip active={category === "saved"} onClick={() => setCategory("saved")}>★ Saved</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={retry} />}
      {!items && !error && <ListSkeleton />}
      {items?.length === 0 && category === "saved" && (
        <EmptyState title="No saved products yet" body="Open a product and tap ☆ Save to keep it here." />
      )}
      {items?.length === 0 && category !== "saved" && (
        <EmptyState title="No products here yet" body="We only show products after checking real market prices. Try another category or check back soon." />
      )}
      {items && items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function savedIds(): Promise<Set<string>> {
  const { data, error } = await createClient().from("saved_products").select("product_id");
  if (error) throw new Error("We couldn't load your saved products. Please try again.");
  return new Set(data.map((row) => row.product_id as string));
}

function ProductCard({ product: p }: { product: ProductListItem }) {
  const losing = p.profit_paise <= 0;
  return (
    <Link
      href={`/products/${p.id}`}
      className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 active:bg-neutral-50"
    >
      <ProductImage src={p.image_urls[0]} name={p.name} className="h-20 w-20 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 text-sm font-medium text-neutral-900">{p.name}</h2>
          <ScoreBadge score={p.score} />
        </div>
        <p className={`mt-auto text-xl font-bold tabular-nums ${losing ? "text-red-600" : "text-neutral-900"}`}>
          {formatRupees(p.profit_paise)}
          <span className="ml-1 text-xs font-normal text-neutral-500">profit/order</span>
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
          <span>Sells at {formatRupees(p.selling_price_paise)}</span>
          {p.loss_trap && <LossTrapTag />}
        </div>
      </div>
    </Link>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full border px-4 text-sm ${
        active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <ul className="mt-4 flex flex-col gap-3" aria-label="Loading products">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex animate-pulse gap-3 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="h-20 w-20 rounded-lg bg-neutral-200" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-3/4 rounded bg-neutral-200" />
            <div className="mt-auto h-6 w-1/2 rounded bg-neutral-200" />
            <div className="h-3 w-1/3 rounded bg-neutral-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
