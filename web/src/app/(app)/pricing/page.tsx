"use client";

import { Crown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { messagesNow, useT } from "@/lib/i18n";
import type { Me } from "@/lib/reels";
import { PageHero, card } from "@/components/ui";

type Order = { order_id: string; amount_paise: number; currency: string; key_id: string; prefill: { email: string; contact: string } };
type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: () => void) => void };
  }
}

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(messagesNow().pricing.loadFailed));
    document.body.appendChild(s);
  });
}

export default function PricingPage() {
  const { t } = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiFetch<Me>("/me").then(setMe).catch(() => {});
  }, []);

  async function preorder() {
    setBusy(true);
    setMessage(null);
    try {
      const order = await apiFetch<Order>("/preorders", { method: "POST" });
      await loadCheckout();
      const checkout = new window.Razorpay!({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: "Trend2Cart AI",
        description: "Founding member pre-order",
        prefill: order.prefill,
        theme: { color: "#7c3aed" },
        handler: async (resp: RazorpayResponse) => {
          try {
            await apiFetch("/preorders/verify", { method: "POST", body: JSON.stringify(resp) });
            setMessage({ text: t.pricing.paid, ok: true });
            apiFetch<Me>("/me").then(setMe).catch(() => {});
          } catch (err) {
            setMessage({ text: (err as ApiError).message, ok: false });
          }
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", () => {
        setMessage({ text: t.pricing.failed, ok: false });
        setBusy(false);
      });
      checkout.open();
    } catch (err) {
      setMessage({ text: (err as Error).message, ok: false });
      setBusy(false);
    }
  }

  const founding = me && me.profile.plan !== "free";

  return (
    <>
      <PageHero icon={Crown} title={t.pricing.title} subtitle={t.pricing.subtitle} tone="sunset" />

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <Plan name={t.pricing.free} price="₹0" items={t.pricing.freeItems} current={me?.profile.plan === "free"} currentLabel={t.pricing.yourPlan} />
        <Plan name={t.pricing.founding} price="₹99" note={t.pricing.oneTime} items={t.pricing.foundingItems} current={!!founding} currentLabel={t.pricing.yourPlan} highlight>
          {!founding && (
            <button onClick={preorder} disabled={busy || !me} className="mt-4 h-12 w-full rounded-xl bg-card-muted font-bold text-brand-700 shadow-md disabled:opacity-50">
              {busy ? t.pricing.opening : t.pricing.preorder}
            </button>
          )}
        </Plan>
      </div>

      {message && (
        <p role="alert" className={`mt-4 rounded-xl p-3 text-sm ${message.ok ? "bg-profit/10 text-profit" : "bg-red/10 text-red"}`}>
          {message.text}
        </p>
      )}
      <p className="mt-4 text-xs text-ink-2">{t.pricing.note}</p>
      <Link href="/account" className="mt-4 block text-sm font-medium text-brand-700">{t.pricing.backAccount}</Link>
    </>
  );
}

function Plan(props: { name: string; price: string; note?: string; items: string[]; current: boolean; currentLabel: string; highlight?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl p-5 ${props.highlight ? "rounded-[40px] bg-charcoal text-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)]" : card}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">{props.name}</h2>
        {props.current && <span className="rounded-full bg-profit/10 px-2 py-0.5 text-xs font-bold text-profit">{props.currentLabel}</span>}
      </div>
      <p className="mt-1 text-4xl font-medium">
        {props.price}
        {props.note && <span className="ml-1 text-sm font-normal opacity-75">{props.note}</span>}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {props.items.map((i) => <li key={i}>✓ {i}</li>)}
      </ul>
      {props.children}
    </section>
  );
}
