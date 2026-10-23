"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInForm() {
  const router = useRouter();
  const googleFailed = useSearchParams().get("error") === "google";
  const supabase = createClient();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    googleFailed ? "Google sign-in didn't finish. Please try again." : null,
  );

  const fullPhone = `+91${phone}`;

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError("Couldn't open Google sign-in. Please try again.");
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setBusy(false);
    if (error) setError("We couldn't send the SMS. Check the number and try again in a minute.");
    else setCodeSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
    setBusy(false);
    if (error) setError("That code is wrong or has expired. Check the SMS or request a new code.");
    else router.replace("/products");
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <button
        onClick={signInWithGoogle}
        className="h-12 rounded-lg border border-neutral-300 bg-white font-medium text-neutral-900 active:bg-neutral-100"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-neutral-200" /> or use your phone <span className="h-px flex-1 bg-neutral-200" />
      </div>

      {!codeSent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="phone" className="text-sm font-medium">Mobile number</label>
          <div className="flex h-12 items-center rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900">
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
          <button disabled={busy} className="h-12 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <label htmlFor="otp" className="text-sm font-medium">Enter the 6-digit code sent to {fullPhone}</label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="h-12 rounded-lg border border-neutral-300 bg-white px-3 text-center text-lg tracking-widest text-neutral-900 outline-none focus:border-neutral-900"
          />
          <button disabled={busy || otp.length !== 6} className="h-12 rounded-lg bg-neutral-900 font-medium text-white disabled:opacity-50">
            {busy ? "Checking…" : "Verify and sign in"}
          </button>
          <button type="button" onClick={() => { setCodeSent(false); setOtp(""); }} className="text-sm text-neutral-600 underline">
            Change number
          </button>
        </form>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
