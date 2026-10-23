"use client";

import Link from "next/link";
import { fmt, useT } from "@/lib/i18n";
import type { Me } from "@/lib/reels";

/** "2 of 3 free Reels left this month" plus a pricing link on the free plan. */
export default function QuotaLine({ me, tone = "dark" }: { me: Me; tone?: "dark" | "light" }) {
  const { t, date } = useT();
  const text =
    me.reels.limit === null
      ? t.reels.unlimited
      : fmt(t.reels.left, { left: me.reels.left ?? 0, limit: me.reels.limit }) +
        (me.reels.resets_at ? fmt(t.reels.resets, { date: date(me.reels.resets_at) }) : "");
  return (
    <p className={`mt-1 text-sm ${tone === "light" ? "text-white/90" : "text-neutral-600"}`}>
      {text}
      {me.profile.plan === "free" && (
        <>
          {" · "}
          <Link href="/pricing" className={`font-bold underline ${tone === "light" ? "text-white" : "text-brand-700"}`}>
            {t.reels.getUnlimited}
          </Link>
        </>
      )}
    </p>
  );
}
