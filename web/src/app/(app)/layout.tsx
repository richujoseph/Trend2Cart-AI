import BottomNav from "@/components/bottom-nav";
import { TopBar } from "@/components/ui";
import { LanguageSync } from "@/lib/profile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <TopBar />
      <LanguageSync />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
