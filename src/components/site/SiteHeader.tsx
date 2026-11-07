import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_SITE } from "@/lib/site/contato";

const LINKS = [
  { href: "/servicos", rotulo: "Serviços" },
  { href: "/cases", rotulo: "Cases" },
  { href: "/blog", rotulo: "Blog" },
  { href: "/sobre", rotulo: "Sobre" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Yide Digital, página inicial">
          <Image src="/brand/logo-yide.png" alt="Yide Digital" width={90} height={50} priority className="h-8 w-auto" />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-white/60 transition-colors hover:text-white">
              {l.rotulo}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/diagnostico" className="hidden rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white sm:inline-flex">
            Diagnóstico grátis
          </Link>
          <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-teal-500 px-4 py-1.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-cyan-400">
            WhatsApp
          </a>
          <details className="relative md:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 text-white/80 [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <nav aria-label="Menu" className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-neutral-900 p-2 shadow-xl">
              {[...LINKS, { href: "/diagnostico", rotulo: "Diagnóstico grátis" }].map((l) => (
                <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white">{l.rotulo}</Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
    </header>
  );
}
