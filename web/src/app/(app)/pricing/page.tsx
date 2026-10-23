"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { Me } from "@/lib/reels";

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
    s.onerror = () => reject(new Error("We couldn't load the payment page. Check your internet and try again."));
    document.body.appendChild(s);
  });
}

const FREE = ["Profit scores for every product", "3 Reels a month (Malayalam, Hindi, English)", "Conversion Doctor check-ups"];
const FOUNDING = ["Everything in Free", "Unlimited Reels while we're in beta", "Founding-member price, paid once"];

export default function PricingPage() {
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
        theme: { color: "#111111" },
        handler: async (resp: RazorpayResponse) => {
          try {
            await apiFetch("/preorders/verify", { method: "POST", body: JSON.stringify(resp) });
            setMessage({ text: "Payment received. Welcome, founding member! Your Reels are now unlimited.", ok: true });
            apiFetch<Me>("/me").then(setMe).catch(() => {});
          } catch (err) {
            setMessage({ text: (err as ApiError).message, ok: false });
          }
          setBusy(false);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", () => {
        setMessage({ text: "The payment didn't go through. No money was taken. Please try again.", ok: false });
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
      <h1 className="text-xl font-bold">Plans</h1>
      <p className="mt-1 text-sm text-neutral-600">Start free. Pre-order the founding plan to support us and remove the Reel limit.</p>

      <div className="mt-4 flex flex-col gap-3">
        <Plan name="Free" price="₹0" items={FREE} current={me?.profile.plan === "free"} />
        <Plan name="Founding member" price="₹99" note="one-time pre-order" items={FOUNDING} current={!!founding} highlight>
          {!founding && (
            <button onClick={preorder} disabled={busy || !me} className="mt-4 h-12 w-full rounded-lg bg-white font-semibold text-neutral-900 disabled:opacity-50">
              {busy ? "Opening payment…" : "Pre-order for ₹99"}
            </button>
          )}
        </Plan>
      </div>

      {message && (
        <p role="alert" className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-500">
        Payments by Razorpay (UPI, cards, net banking). This is a test-mode pre-order during our beta.
      </p>
      <Link href="/account" className="mt-4 block text-sm underline">← Back to account</Link>
    </>
  );
}

function Plan(props: { name: string; price: string; note?: string; items: string[]; current: boolean; highlight?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`rounded-xl p-4 ${props.highlight ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white"}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{props.name}</h2>
        {props.current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Your plan</span>}
      </div>
      <p className="mt-1 text-3xl font-bold">
        {props.price}
        {props.note && <span className="ml-1 text-sm font-normal opacity-75">{props.note}</span>}
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {props.items.map((i) => <li key={i}>✓ {i}</li>)}
      </ul>
      {props.children}
    </section>
  );
}
