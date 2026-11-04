import type { Metadata } from "next";
import { display, sans } from "@/fonts";
import { SITE_URL } from "@/lib/blog/config";


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
