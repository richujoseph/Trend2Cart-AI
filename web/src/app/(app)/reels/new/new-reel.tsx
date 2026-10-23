"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Simulation } from "@/lib/products";
import { ErrorState, ProductImage } from "@/components/states";

// Entry point of the Reel flow. Script, voice and video steps come in the Reels task.
export default function NewReel() {
  const productId = useSearchParams().get("product");
  const [product, setProduct] = useState<Simulation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    apiFetch<Simulation>(`/products/${productId}/simulate`, { method: "POST" })
      .then(setProduct)
      .catch((e: Error) => setError(e.message));
  }, [productId]);

  return (
    <>
      <h1 className="text-xl font-bold">Make a Reel</h1>
      {!productId && (
        <p className="mt-2 text-sm text-neutral-600">
          Pick a product first. <Link href="/products" className="underline">Browse products</Link>
        </p>
      )}
      {error && <ErrorState message={error} />}
      {product && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3">
          <ProductImage src={product.image_urls[0]} name={product.name} className="h-14 w-14 rounded-lg" />
          <div>
            <p className="text-xs text-neutral-500">Selected product</p>
            <p className="font-medium">{product.name}</p>
          </div>
        </div>
      )}
      <p className="mt-6 text-sm text-neutral-500">Reel maker coming soon.</p>
    </>
  );
}
