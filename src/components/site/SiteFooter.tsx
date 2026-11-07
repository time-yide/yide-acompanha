import Link from "next/link";
import Image from "next/image";
import { YIDE_NAP, SEED_SERVICOS } from "@/lib/seo/config";
import { WHATSAPP_SITE } from "@/lib/site/contato";

export function SiteFooter() {
  return (
    <footer className="bg-neutral-950 text-white">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image src="/brand/logo-yide.png" alt="Yide Digital" width={110} height={60} className="h-9 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-white/55">
              Agência de marketing, vendas e IA em Cuiabá. Atendemos Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Serviços</p>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              {SEED_SERVICOS.map((s) => (
                <li key={s.slug}><Link href={`/servicos/${s.slug}`} className="transition-colors hover:text-white">{s.nome}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">A Yide</p>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              <li><Link href="/sobre" className="transition-colors hover:text-white">Sobre</Link></li>
              <li><Link href="/cases" className="transition-colors hover:text-white">Cases</Link></li>
              <li><Link href="/blog" className="transition-colors hover:text-white">Blog</Link></li>
              <li><Link href="/diagnostico" className="transition-colors hover:text-white">Diagnóstico grátis</Link></li>
              <li><Link href="/politica-de-privacidade" className="transition-colors hover:text-white">Política de privacidade</Link></li>
            </ul>
          </div>
          <address className="not-italic">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Contato</p>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              <li><a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">WhatsApp {YIDE_NAP.telefone}</a></li>
              <li>{YIDE_NAP.email}</li>
              <li>{YIDE_NAP.rua}<br />{YIDE_NAP.cidade} · {YIDE_NAP.uf} · {YIDE_NAP.cep}</li>
              <li>Atendimento 24 horas</li>
              <li className="flex gap-4 pt-1">
                <a href="https://www.instagram.com/yide.digital/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Instagram</a>
                <a href="https://maps.google.com/?cid=14243144777750195365" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Google Maps</a>
              </li>
            </ul>
          </address>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Yide Digital</span>
          <span>Marketing · Vendas · Tecnologia · IA</span>
        </div>
      </div>
    </footer>
  );
}
