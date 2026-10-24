"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CircleUserRound, Clapperboard, Package, Plus, Stethoscope } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LanguageSelect, Logo } from "@/components/ui";

const ITEMS = [
  { href: "/products", key: "products", icon: Package },
  { href: "/reels", key: "reels", icon: Clapperboard },
  { href: "/doctor", key: "doctor", icon: Stethoscope },
  { href: "/account", key: "account", icon: CircleUserRound },
] as const;

/** Desktop navigation (lg and up). Phones use the floating bottom nav instead. */
export default function SideNav() {
  return (
    <Suspense fallback={<Nav pathname="" />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <Nav pathname={usePathname()} />;
}

function Nav({ pathname }: { pathname: string }) {
  const { t } = useT();
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-sage/30 bg-white/60 px-5 py-7 backdrop-blur lg:flex">
      <Link href="/products" className="flex items-center gap-3 px-2">
        <Logo size={40} />
        <span className="font-[family-name:var(--font-display)] text-[22px] font-semibold tracking-tight text-charcoal">Trend2Cart</span>
      </Link>
      <nav className="mt-10 flex flex-col gap-1.5" aria-label="Main">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href) && !(href === "/reels" && pathname.startsWith("/reels/new"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-bold transition ${
                active ? "bg-charcoal text-white shadow-[0_12px_30px_-12px_rgba(23,30,25,0.6)]" : "text-ink-2 hover:bg-card-muted hover:text-charcoal"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden /> {t.nav[key]}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/reels/new"
        className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full bg-red text-[15px] font-extrabold text-white shadow-[0_12px_28px_-10px_rgba(202,0,19,0.5)] transition hover:brightness-110"
      >
        <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden /> {t.common.makeReel}
      </Link>
      <div className="mt-auto flex flex-col gap-3 rounded-[24px] border border-sage/30 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">{t.common.language}</p>
        <LanguageSelect />
      </div>
    </aside>
  );
}
