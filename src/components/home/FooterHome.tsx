import Link from "next/link";
import Image from "next/image";
import { YIDE_NAP } from "@/lib/seo/config";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function FooterHome() {
  return (
    <footer className="bg-neutral-950 text-white">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Image src="/brand/logo-yide.png" alt="Yide Digital" width={110} height={60} className="h-9 w-auto" />
            <p className="mt-4 max-w-sm text-sm text-white/55">
              Marketing, tecnologia e IA para negócios que querem crescer. De Cuiabá para todo o Brasil.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Navegue</p>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              <li><Link href="/servicos" className="transition-colors hover:text-white">Serviços</Link></li>
              <li><Link href="/cases" className="transition-colors hover:text-white">Cases</Link></li>
              <li><Link href="/blog" className="transition-colors hover:text-white">Blog</Link></li>
              <li><a href="#contato" className="transition-colors hover:text-white">Contato</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Fale com a gente</p>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              <li>{YIDE_NAP.telefone}</li>
              <li><a href={`mailto:${YIDE_NAP.email}`} className="transition-colors hover:text-white">{YIDE_NAP.email}</a></li>
              <li>{YIDE_NAP.cidade} · {YIDE_NAP.uf}</li>
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://instagram.com/yide.digital"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da Yide"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-teal-400 hover:text-teal-400"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.linkedin.com/company/yide-digital"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn da Yide"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-teal-400 hover:text-teal-400"
              >
                <LinkedinIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Yide Digital</span>
          <span>Marketing · Tecnologia · IA · Programação</span>
        </div>
      </div>
    </footer>
  );
}
