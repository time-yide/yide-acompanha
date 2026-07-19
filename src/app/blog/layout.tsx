import Link from "next/link";
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
      <header className="border-b border-neutral-200/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/blog" className="text-xl font-bold tracking-tight [font-family:var(--font-display)]">
            Yide <span className="text-teal-600">Blog</span>
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

      <footer className="border-t border-neutral-200/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-8 text-xs text-neutral-500">
          <span>© {new Date().getFullYear()} Yide Digital</span>
          <span>Marketing · Tecnologia · IA · Programação</span>
        </div>
      </footer>
    </div>
  );
}
