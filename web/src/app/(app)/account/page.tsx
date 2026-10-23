"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type Me = {
  email: string | null;
  phone: string | null;
  profile: { plan: string; language: string; reels_used_this_month: number };
};

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>("/me").then(setMe).catch((e: Error) => setError(e.message));
  }, []);

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
        <dl className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white text-sm">
          <Row label="Signed in as" value={me.email ?? (me.phone ? `+${me.phone}` : "—")} />
          <Row label="Plan" value={me.profile.plan} />
          <Row label="Language" value={me.profile.language} />
          <Row label="Reels this month" value={String(me.profile.reels_used_this_month)} />
        </dl>
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
    <div className="flex justify-between p-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium capitalize text-neutral-900">{value}</dd>
    </div>
  );
}
