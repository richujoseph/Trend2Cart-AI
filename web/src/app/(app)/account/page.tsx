"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { type Lang, showLanguage, useT } from "@/lib/i18n";
import { LANGUAGES, type Me, REGIONS } from "@/lib/reels";
import { saveProfile, useLanguage } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import QuotaLine from "@/components/quota-line";
import { PageHero, btnPrimary, btnSecondary, card } from "@/components/ui";

const PLAN_KEY = { free: "planFree", pro: "planPro", founding: "planFounding" } as const;

export default function AccountPage() {
  const { t } = useT();
  const router = useRouter();
  const { lang, setLanguage, error: langError } = useLanguage();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Me>("/me").then(setMe).catch((e: Error) => setError(e.message));
  }, []);

  async function pickLanguage(next: Lang) {
    setSaved(false);
    await setLanguage(next);
    setSaved(true);
  }

  // Picking a region also sets the language (Kerala → Malayalam, Tamil Nadu → English); either can be changed.
  async function pickRegion(region: (typeof REGIONS)[number]) {
    if (!me) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveProfile({ region: region.value, language: region.language });
      setMe({ ...me, profile: { ...me.profile, region: region.value, language: region.language } });
      showLanguage(region.language);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Dev only: copy the access token to paste into http://localhost:8000/docs → Authorize.
  async function copyToken() {
    const { data } = await createClient().auth.getSession();
    if (!data.session) return setError(t.api.signIn);
    await navigator.clipboard.writeText(data.session.access_token);
    alert(t.account.tokenCopied);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/sign-in");
  }

  const option = (active: boolean) =>
    `h-12 rounded-xl text-sm font-semibold transition ${active ? "bg-gradient-to-br from-brand-600 to-fuchsia-600 text-white shadow-md shadow-brand-600/25" : "bg-white ring-1 ring-brand-100"}`;

  return (
    <>
      <PageHero title={t.account.title} subtitle={t.account.subtitle}>
        {me && <p className="mt-3 truncate text-sm font-semibold">{me.email || (me.phone ? `+${me.phone}` : "")}</p>}
      </PageHero>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!me && !error && <p className="mt-4 text-sm text-neutral-500">{t.common.loading}</p>}
      {me && (
        <>
          <section className={`${card} mt-4 p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">{t.account.plan}</span>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-800">{t.account[PLAN_KEY[me.profile.plan]]}</span>
            </div>
            <QuotaLine me={me} />
            {me.profile.plan === "free" && (
              <Link href="/pricing" className={`${btnPrimary} mt-3 w-full`}>
                {t.account.getUnlimited99}
              </Link>
            )}
          </section>

          <fieldset className={`${card} mt-4 p-4`}>
            <legend className="float-left w-full font-bold text-brand-900">🗣️ {t.account.language}</legend>
            <p className="text-xs text-neutral-500">{t.account.languageHint}</p>
            <div className="clear-both mt-3 grid grid-cols-3 gap-2 pt-1">
              {LANGUAGES.map((l) => (
                <button key={l.value} type="button" aria-pressed={lang === l.value} onClick={() => pickLanguage(l.value)} className={option(lang === l.value)}>
                  {l.native}
                </button>
              ))}
            </div>
            {langError && <p role="alert" className="mt-2 text-xs text-red-700">{langError}</p>}
          </fieldset>

          <fieldset className={`${card} mt-4 p-4`}>
            <legend className="float-left w-full font-bold text-brand-900">📍 {t.account.whereSell}</legend>
            <div className="clear-both mt-3 grid grid-cols-2 gap-2 pt-1">
              {REGIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={me.profile.region === r.value}
                  onClick={() => pickRegion(r)}
                  className={option(me.profile.region === r.value)}
                >
                  {t.regions[r.value]}
                </button>
              ))}
            </div>
          </fieldset>
          {saved && !langError && <p className="mt-2 text-center text-xs font-semibold text-emerald-700">{t.common.saved}</p>}
        </>
      )}
      {process.env.NODE_ENV === "development" && (
        <button onClick={copyToken} className="mt-6 h-12 w-full rounded-xl border border-dashed border-brand-300 text-sm text-brand-700">
          {t.account.copyToken}
        </button>
      )}
      <button onClick={signOut} className={`${btnSecondary} mt-6 w-full`}>
        {t.account.signOut}
      </button>
    </>
  );
}
