"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CircleUserRound, Clapperboard, Package, Plus, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";

const LEFT = [
  { href: "/products", key: "products", icon: Package },
  { href: "/reels", key: "reels", icon: Clapperboard },
] as const;
const RIGHT = [
  { href: "/doctor", key: "doctor", icon: Stethoscope },
  { href: "/account", key: "account", icon: CircleUserRound },
] as const;

// usePathname is dynamic, so it sits behind Suspense; the fallback is the same nav with no tab highlighted.
export default function BottomNav() {
  return (
    <Suspense fallback={<Nav pathname="" />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <Nav pathname={usePathname()} />;
}

/** Floating charcoal pill, 8px from the edges, with a raised red "Make a Reel" action in the middle. */
function Nav({ pathname }: { pathname: string }) {
  const { t } = useT();
  const item = ({ href, key, icon: Icon }: { href: string; key: "products" | "reels" | "doctor" | "account"; icon: LucideIcon }) => {
    const active = pathname.startsWith(href) && !(href === "/reels" && pathname.startsWith("/reels/new"));
    return (
      <li key={href} className="flex justify-center">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full transition ${active ? "bg-white/10 text-white" : "text-sage hover:text-white"}`}
        >
          <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
          <span className="sr-only">{t.nav[key]}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 mx-auto max-w-md">
      <ul className="relative grid h-16 grid-cols-5 items-center rounded-full bg-charcoal px-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)]">
        {LEFT.map(item)}
        <li className="flex justify-center">
          <Link
            href="/reels/new"
            aria-label={t.common.makeReel}
            className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full border-4 border-offwhite bg-red text-white shadow-lg shadow-red/30 transition active:scale-95"
          >
            <Plus className="h-7 w-7" strokeWidth={2.6} aria-hidden />
          </Link>
        </li>
        {RIGHT.map(item)}
      </ul>
    </nav>
  );
}
