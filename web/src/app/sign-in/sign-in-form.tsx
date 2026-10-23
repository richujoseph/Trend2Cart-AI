"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fmt, useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { btnPrimary, btnSecondary, input } from "@/components/ui";

export default function SignInForm() {
  const { t } = useT();
  const router = useRouter();
  const googleFailed = useSearchParams().get("error") === "google";
  const supabase = createClient();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? (googleFailed ? t.signIn.errGoogleFailed : null);

  const fullPhone = `+91${phone}`;

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(t.signIn.errGoogleOpen);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(t.signIn.errPhone);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setBusy(false);
    if (error) setError(t.signIn.errSms);
    else setCodeSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
    setBusy(false);
    if (error) setError(t.signIn.errCode);
    else router.replace("/products");
  }

  return (
    <div className="flex flex-col gap-5">
      <button onClick={signInWithGoogle} className={btnSecondary}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0012 24z" />
          <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 010-4.6V6.6H1.4a12 12 0 000 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 001.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
        </svg>
        {t.signIn.google}
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-brand-100" /> {t.signIn.orPhone} <span className="h-px flex-1 bg-brand-100" />
      </div>

      {!codeSent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="phone" className="text-sm font-semibold">{t.signIn.mobile}</label>
          <div className="flex h-12 items-center rounded-xl border border-brand-100 bg-white focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
            <span className="pl-3 pr-2 text-neutral-500">+91</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="h-full flex-1 bg-transparent pr-3 text-neutral-900 outline-none"
              placeholder="98765 43210"
            />
          </div>
          <button disabled={busy} className={btnPrimary}>
            {busy ? t.signIn.sending : t.signIn.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <label htmlFor="otp" className="text-sm font-semibold">{fmt(t.signIn.enterCode, { phone: fullPhone })}</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className={`${input} text-center text-lg tracking-widest`}
          />
          <button disabled={busy || otp.length !== 6} className={btnPrimary}>
            {busy ? t.signIn.checking : t.signIn.verify}
          </button>
          <button type="button" onClick={() => { setCodeSent(false); setOtp(""); }} className="text-sm font-medium text-brand-700 underline">
            {t.signIn.changeNumber}
          </button>
        </form>
      )}

      {shownError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{shownError}</p>}
    </div>
  );
}
