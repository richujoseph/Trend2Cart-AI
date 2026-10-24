import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Mukta, Noto_Sans_Malayalam } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const malayalam = Noto_Sans_Malayalam({ variable: "--font-malayalam", subsets: ["malayalam"] });
const devanagari = Mukta({ variable: "--font-devanagari", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trend2Cart AI",
  description: "Find profitable products and make Reels in Malayalam, Hindi or English.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${malayalam.variable} ${devanagari.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
