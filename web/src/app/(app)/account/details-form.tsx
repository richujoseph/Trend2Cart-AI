"use client";

import { useState } from "react";
import { Check, Mail, MapPin, MessageCircle, Store, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { saveProfile } from "@/lib/profile";
import type { Me } from "@/lib/reels";
import { btn, card, input } from "@/components/ui";

type Details = { display_name: string; business_name: string; whatsapp: string; city: string };

/** The seller's own details: name, shop name, WhatsApp number and city. Email/phone come from sign-in. */
export default function DetailsForm({ me, onSaved }: { me: Me; onSaved: (d: Details) => void }) {
  const { t } = useT();
  const initial: Details = {
    display_name: me.profile.display_name ?? "",
    business_name: me.profile.business_name ?? "",
    whatsapp: me.profile.whatsapp ?? "",
    city: me.profile.city ?? "",
  };
  const [form, setForm] = useState<Details>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = (Object.keys(form) as (keyof Details)[]).some((k) => form[k].trim() !== initial[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.whatsapp && !/^[6-9]\d{9}$/.test(form.whatsapp)) return setError(t.account.errWhatsapp);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Details;
      await saveProfile(trimmed);
      onSaved(trimmed);
      setSaved(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof Details, label: string, icon: LucideIcon, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const Icon = icon;
    return (
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden /> {label}
        </span>
        <input
          value={form[key]}
          onChange={(e) => {
            setSaved(false);
            setForm((f) => ({ ...f, [key]: key === "whatsapp" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value }));
          }}
          className={input}
          {...extra}
        />
      </label>
    );
  };

  return (
    <form onSubmit={save} className={`${card} p-6`}>
      <h2 className="text-2xl font-black text-charcoal">{t.account.detailsTitle}</h2>
      <p className="mt-1 text-[13px] text-ink-2">{t.account.detailsSub}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {field("display_name", t.account.name, UserRound, { maxLength: 60, autoComplete: "name", placeholder: t.account.namePlaceholder })}
        {field("business_name", t.account.business, Store, { maxLength: 80, autoComplete: "organization", placeholder: t.account.businessPlaceholder })}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
            <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden /> {t.account.whatsapp}
          </span>
          <span className="flex h-12 items-center rounded-[16px] border border-sage/50 bg-white focus-within:border-charcoal">
            <span className="pl-4 pr-2 text-[15px] font-semibold text-ink-3">+91</span>
            <input
              value={form.whatsapp}
              onChange={(e) => {
                setSaved(false);
                setForm((f) => ({ ...f, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) }));
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              className="h-full min-w-0 flex-1 rounded-r-[16px] bg-transparent pr-4 text-[15px] font-semibold tabular-nums text-charcoal outline-none placeholder:font-normal placeholder:text-ink-3"
            />
          </span>
        </label>
        {field("city", t.account.city, MapPin, { maxLength: 60, autoComplete: "address-level2", placeholder: t.account.cityPlaceholder })}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
            <Mail className="h-4 w-4" strokeWidth={2} aria-hidden /> {t.account.signedInAs}
          </span>
          <p className="flex h-12 items-center rounded-[16px] bg-card-muted px-4 text-[15px] font-semibold text-ink-2">
            {me.email || (me.phone ? `+${me.phone}` : "")}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-[16px] bg-red/10 p-3 text-sm font-semibold text-red">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <button disabled={busy || !changed} className={btn.light}>
          {busy ? t.account.saving : t.account.saveDetails}
        </button>
        {saved && !changed && (
          <span role="status" className="flex items-center gap-1 text-sm font-bold text-profit">
            <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden /> {t.common.saved.replace(" ✓", "")}
          </span>
        )}
      </div>
    </form>
  );
}
