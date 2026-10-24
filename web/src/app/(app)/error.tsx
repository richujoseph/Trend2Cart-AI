"use client";

import Link from "next/link";
import { CircleAlert, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { btnPrimary, btnSecondary } from "@/components/ui";

// Any crash inside an app screen lands here instead of a blank page; the top bar and nav stay usable.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="mt-10 flex flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <CircleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-extrabold text-brand-900">{t.api.crashTitle}</h1>
      <p className="mt-1 text-sm text-neutral-600">{t.api.crashBody}</p>
      <div className="mt-5 flex w-full gap-2">
        <button onClick={reset} className={`${btnPrimary} flex-1`}>
          <RotateCw className="h-4 w-4" aria-hidden /> {t.common.tryAgain}
        </button>
        <Link href="/products" className={`${btnSecondary} flex-1`}>{t.api.goProducts}</Link>
      </div>
    </div>
  );
}
