"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { en, type Messages } from "./en";
import { hi } from "./hi";
import { ml } from "./ml";

export type Lang = "en" | "ml" | "hi";
const MESSAGES: Record<Lang, Messages> = { en, ml, hi };
export const LOCALE: Record<Lang, string> = { en: "en-IN", ml: "ml-IN", hi: "hi-IN" };

// The seller's language lives in their profile (so it follows them across phones). This browser keeps a
// copy so the app shows the right language instantly on load, and remembers a choice made before sign-in.
const KEY = "t2c-lang";
const PENDING = "t2c-lang-pending"; // chosen while signed out; pushed to the profile after sign-in
const EVENT = "t2c-lang";

const isLang = (v: unknown): v is Lang => v === "en" || v === "ml" || v === "hi";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

let pickedOnThisPage = false;

/** Show this language now (no server call). "server" = the profile's language arriving after page load: it must
 *  not undo a choice the seller made while that request was in flight. */
export function showLanguage(lang: Lang, source: "seller" | "server" = "seller") {
  if (source === "server" && pickedOnThisPage) return;
  if (source === "seller") pickedOnThisPage = true;
  write(KEY, lang);
  window.dispatchEvent(new Event(EVENT));
}

export function pendingLanguage(): Lang | null {
  const v = read(PENDING);
  return isLang(v) ? v : null;
}

export function rememberPendingLanguage(lang: Lang | null) {
  write(PENDING, lang);
}

/** {name} placeholders → values. */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

type Ctx = { lang: Lang; t: Messages; date: (iso: string) => string };
const I18n = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, () => read(KEY), () => null);
  const lang: Lang = isLang(stored) ? stored : "en";

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const date = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" }),
    [lang],
  );
  const value = useMemo(() => ({ lang, t: MESSAGES[lang], date }), [lang, date]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useT(): Ctx {
  const ctx = useContext(I18n);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx;
}

/** Messages for code outside React (e.g. apiFetch errors). */
export function messagesNow(): Messages {
  const v = read(KEY);
  return MESSAGES[isLang(v) ? v : "en"];
}
