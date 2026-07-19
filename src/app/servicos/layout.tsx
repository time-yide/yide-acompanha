import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/blog/config";

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans-blog", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function ServicosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${sans.variable} min-h-screen bg-[#faf9f7] text-neutral-900 antialiased [font-family:var(--font-sans-blog)] [color-scheme:light]`}
    >
      {/* Masthead escuro — o logo ciano brilha no preto */}
      <header className="sticky top-0 z-20 bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/servicos" className="flex items-center gap-3" aria-label="Yide Serviços">
            <Image src="/brand/logo-yide.png" alt="Yide Digital" width={90} height={50} priority className="h-9 w-auto" />
            <span className="hidden text-lg font-semibold tracking-tight text-white/45 [font-family:var(--font-display)] sm:inline">Serviços</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/servicos" className="text-sm font-medium text-white/55 transition-colors hover:text-white">
              Serviços
            </Link>
            <Link href="/blog" className="text-sm font-medium text-white/55 transition-colors hover:text-white">
              Blog
            </Link>
            <a
              href="https://wa.me/5565981447380"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              Falar no WhatsApp
            </a>
          </nav>
        </div>
        {/* fio de cor da marca na base */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">{children}</main>

      <footer className="mt-10 bg-neutral-950">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <Image src="/brand/logo-yide.png" alt="Yide Digital" width={80} height={44} className="h-7 w-auto" />
          <div className="flex flex-col items-end gap-1 text-xs text-white/45">
            <span>© {new Date().getFullYear()} Yide Digital</span>
            <span>Marketing · Tecnologia · IA · Programação</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
