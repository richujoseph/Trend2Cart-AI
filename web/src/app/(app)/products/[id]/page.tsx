import { Suspense } from "react";
import ProductDetail, { DetailSkeleton } from "./product-detail";

export default function ProductPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  );
}
