"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

const TABS = [
  { href: "/products", key: "products", icon: "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" },
  { href: "/reels", key: "reels", icon: "M4 5h16v14H4zM10 9l5 3-5 3z" },
  { href: "/doctor", key: "doctor", icon: "M3 12h4l3-7 4 14 3-7h4" },
  { href: "/account", key: "account", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0" },
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

function Nav({ pathname }: { pathname: string }) {
  const { t } = useT();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-900/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4 px-2">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "font-bold text-brand-700" : "text-neutral-500"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-brand-100" : ""}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={tab.icon} />
                  </svg>
                </span>
                {t.nav[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
