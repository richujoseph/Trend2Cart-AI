"use client";

import { useT } from "@/lib/i18n";
import { LanguageSelect, Logo } from "@/components/ui";

export default function SignInHero() {
  const { t } = useT();
  return (
    <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-fuchsia-600 to-orange-500 p-6 text-white shadow-xl shadow-brand-900/20">
      <span aria-hidden className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <Logo size={44} />
        <LanguageSelect tone="dark" />
      </div>
      <h1 className="relative mt-4 text-3xl font-extrabold tracking-tight">Trend2Cart AI</h1>
      <p className="relative mt-1 text-white/90">{t.signIn.tagline}</p>
      <ul className="relative mt-4 flex flex-col gap-1.5 text-sm">
        {t.signIn.features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
