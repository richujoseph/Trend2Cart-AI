import BottomNav from "@/components/bottom-nav";
import SideNav from "@/components/side-nav";
import { TopBar } from "@/components/ui";
import { LanguageSync } from "@/lib/profile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <LanguageSync />
        <main className="mx-auto w-full max-w-md flex-1 px-5 pb-32 pt-2 lg:max-w-6xl lg:px-10 lg:pb-16 lg:pt-4">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
