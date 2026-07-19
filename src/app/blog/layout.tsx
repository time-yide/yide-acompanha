import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/blog/config";

const display = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans-blog", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} min-h-screen bg-[#faf9f7] text-neutral-900 antialiased [font-family:var(--font-sans-blog)] [color-scheme:light]`}
    >
      {/* Fita de marca no topo */}
      <div className="h-1 w-full bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500" />

      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-[#faf9f7]/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/blog" className="flex items-center gap-2.5" aria-label="Yide Blog">
            <Image src="/brand/logo-yide.png" alt="Yide Digital" width={86} height={48} priority className="h-9 w-auto" />
            <span className="hidden text-lg font-semibold tracking-tight text-neutral-400 [font-family:var(--font-display)] sm:inline">/ Blog</span>
          </Link>
          <a
            href="https://yidedigital.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            yidedigital.com.br
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">{children}</main>

      <footer className="mt-8 border-t border-neutral-200/80 bg-white/50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Image src="/brand/logo-yide.png" alt="Yide Digital" width={72} height={40} className="h-7 w-auto opacity-90" />
          <div className="flex flex-col items-end gap-1 text-xs text-neutral-500">
            <span>© {new Date().getFullYear()} Yide Digital</span>
            <span>Marketing · Tecnologia · IA · Programação</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
