"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { type Lang, pendingLanguage, rememberPendingLanguage, showLanguage, useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Me } from "@/lib/reels";

export type ProfileFields = {
  language?: Lang;
  region?: string;
  display_name?: string;
  business_name?: string;
  whatsapp?: string;
  city?: string;
};

/** Save the seller's preferences/details on the server (it confirms the save, so a failure is never silent).
 *  Fires "t2c-profile" so the header can refresh the seller's name. */
export async function saveProfile(fields: ProfileFields): Promise<void> {
  await apiFetch("/me", { method: "PATCH", body: JSON.stringify(fields) });
  window.dispatchEvent(new Event("t2c-profile"));
}

/** Switch the app language now and save it to the seller's profile; reverts if saving fails. */
export function useLanguage() {
  const { lang } = useT();
  const [error, setError] = useState<string | null>(null);
  const setLanguage = useCallback(
    async (next: Lang) => {
      const before = lang;
      setError(null);
      showLanguage(next);
      // Pending until the server confirms, so a reload mid-save (or signing in later) finishes it.
      rememberPendingLanguage(next);
      const { data } = await createClient().auth.getSession();
      if (!data.session) return;
      try {
        await saveProfile({ language: next });
        rememberPendingLanguage(null);
      } catch (err) {
        rememberPendingLanguage(null);
        showLanguage(before);
        setError((err as Error).message);
      }
    },
    [lang],
  );
  return { lang, setLanguage, error };
}

/** On app load: a choice not yet saved (made before sign-in, or interrupted by a reload) goes to the profile;
 *  otherwise the profile's language wins. */
export function LanguageSync() {
  useEffect(() => {
    apiFetch<Me>("/me")
      .then((me) => {
        const pending = pendingLanguage();
        if (pending) {
          rememberPendingLanguage(null);
          if (pending !== me.profile.language) return saveProfile({ language: pending });
        } else {
          showLanguage(me.profile.language, "server");
        }
      })
      .catch(() => {}); // pages show their own load errors
  }, []);
  return null;
}
