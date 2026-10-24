"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSelect, Logo, RibbonBackground } from "@/components/ui";

export default function SignInHero() {
  const { t } = useT();
  return (
    <div className="relative isolate mb-4 overflow-hidden rounded-[40px] bg-white p-6 ring-1 ring-sage/30 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]">
      <RibbonBackground variant="section" className="-z-10" />
      <div className="flex items-start justify-between gap-3">
        <Link href="/" aria-label="Trend2Cart"><Logo size={48} /></Link>
        <LanguageSelect />
      </div>
      <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">Trend2Cart AI</p>
      <h1 className="text-[32px] font-black leading-tight text-charcoal">Trend2Cart</h1>
      <p className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-ink-2">{t.signIn.tagline}</p>
      <ul className="mt-5 flex flex-col gap-2.5 text-[15px] font-semibold">
        {t.signIn.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-charcoal">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red/10">
              <Check className="h-4 w-4 text-red" strokeWidth={2.6} aria-hidden />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
