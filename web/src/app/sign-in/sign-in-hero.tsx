"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSelect, Logo, Ribbons } from "@/components/ui";

export default function SignInHero() {
  const { t } = useT();
  return (
    <div className="relative mb-4 overflow-hidden rounded-[28px] bg-[#0d0706] p-6 ring-1 ring-white/[0.08]">
      <Ribbons seed={0.8} className="absolute -right-20 -top-6 h-[130%] w-[150%] animate-drift" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0706] via-[#0d0706]/80 to-transparent" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <Link href="/" aria-label="Trend2Cart"><Logo size={40} /></Link>
        <LanguageSelect />
      </div>
      <h1 className="relative mt-6 text-4xl font-light tracking-tight">Trend2Cart</h1>
      <p className="relative mt-2 max-w-[30ch] text-sm leading-relaxed text-ink-2">{t.signIn.tagline}</p>
      <ul className="relative mt-5 flex flex-col gap-2 text-sm">
        {t.signIn.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-ink/90">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Check className="h-3 w-3" aria-hidden />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
