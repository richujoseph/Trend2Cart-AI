"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { type Lang, pendingLanguage, rememberPendingLanguage, showLanguage, useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Me } from "@/lib/reels";

/** Save the seller's preferences on the server (it confirms the save, so a failure is never silent). */
export async function saveProfile(fields: { language?: Lang; region?: string }): Promise<void> {
  await apiFetch("/me", { method: "PATCH", body: JSON.stringify(fields) });
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
