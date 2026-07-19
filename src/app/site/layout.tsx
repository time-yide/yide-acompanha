import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/blog/config";

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans-blog", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} min-h-screen bg-[#faf9f7] text-neutral-900 antialiased [font-family:var(--font-sans-blog)] [color-scheme:light]`}
    >
      {children}
    </div>
  );
}
