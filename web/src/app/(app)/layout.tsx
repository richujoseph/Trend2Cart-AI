import BottomNav from "@/components/bottom-nav";
import { TopBar } from "@/components/ui";
import { LanguageSync } from "@/lib/profile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <TopBar />
      <LanguageSync />
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-32 pt-2">{children}</main>
      <BottomNav />
    </div>
  );
}
