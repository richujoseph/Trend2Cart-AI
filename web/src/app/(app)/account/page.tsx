"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { LANGUAGES, type Language, type Me, REGIONS, reelsLeftText } from "@/lib/reels";
import { saveProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", founding: "Founding member" };

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Me>("/me").then(setMe).catch((e: Error) => setError(e.message));
  }, []);

  // Picking a region also sets the default language (Kerala → Malayalam, Tamil Nadu → English); either can be changed.
  async function save(fields: { language?: Language; region?: string }) {
    if (!me) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await saveProfile(fields);
      setMe({ ...me, profile: { ...me.profile, ...fields } });
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
    if (!data.session) return setError("Please sign in to continue.");
    await navigator.clipboard.writeText(data.session.access_token);
    alert("API token copied. It expires in 1 hour.");
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <>
      <h1 className="text-xl font-bold">Account</h1>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!me && !error && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {me && (
        <>
          <dl className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white text-sm">
            <Row label="Signed in as" value={me.email || (me.phone ? `+${me.phone}` : "—")} />
            <Row label="Plan" value={PLAN_NAMES[me.profile.plan] ?? me.profile.plan} />
            <Row label="Reels" value={reelsLeftText(me)} />
          </dl>

          {me.profile.plan === "free" && (
            <Link href="/pricing" className="mt-3 block rounded-lg bg-neutral-900 p-3 text-center text-sm font-medium text-white">
              Get unlimited Reels for ₹99 →
            </Link>
          )}

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Where you sell</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={me.profile.region === r.value}
                  onClick={() => save({ region: r.value, language: r.language })}
                  className={`h-12 rounded-lg border text-sm ${me.profile.region === r.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Default Reel language</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={me.profile.language === l.value}
                  onClick={() => save({ language: l.value })}
                  className={`h-12 rounded-lg border text-sm ${me.profile.language === l.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}
                >
                  {l.native}
                </button>
              ))}
            </div>
            {saved && <p className="mt-1 text-xs text-emerald-700">Saved ✓</p>}
          </fieldset>
        </>
      )}
      {process.env.NODE_ENV === "development" && (
        <button onClick={copyToken} className="mt-6 h-12 w-full rounded-lg border border-dashed border-neutral-400 text-sm text-neutral-600">
          Copy API token (dev only)
        </button>
      )}
      <button onClick={signOut} className="mt-6 h-12 w-full rounded-lg border border-neutral-300 font-medium">
        Sign out
      </button>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 p-3">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-neutral-900">{value}</dd>
    </div>
  );
}
