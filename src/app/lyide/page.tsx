import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { WHATSAPP_SITE } from "@/lib/site/contato";
import { SITE_URL } from "@/lib/blog/config";

export const metadata: Metadata = {
  title: "Lyide: CRM com IA para vender mais pelo WhatsApp · Yide Digital",
  description: "Conheça o Lyide, o CRM com inteligência artificial da Yide: todas as conversas num lugar só, IA respondendo em segundos, funil, follow-up automático e de qual anúncio veio cada venda.",
  alternates: { canonical: "/lyide" },
  openGraph: { title: "Lyide: CRM com IA da Yide Digital", type: "website", images: ["/videos/lyide-apresentacao.jpg"] },
};

const RECURSOS = [
  { titulo: "Todas as conversas num lugar só", texto: "Todos os vendedores no mesmo número, e cada contato chega marcado com o anúncio que trouxe." },
  { titulo: "IA que responde em segundos", texto: "Atende até de madrugada, pergunta o que o cliente precisa, tira dúvidas e passa o lead já qualificado." },
  { titulo: "Funil com cada cliente", texto: "Cada cliente vira um card: você vê quem está negociando, quem sumiu e quem fechou." },
  { titulo: "Follow-up automático", texto: "O cliente leu e sumiu? A mensagem de retorno sai sozinha, no dia certo." },
  { titulo: "De onde veio cada venda", texto: "No laboratório você vê qual anúncio trouxe a venda, quanto custou e quanto voltou." },
  { titulo: "Time e comissão", texto: "Tempo de resposta de cada vendedor, quem vende mais e a comissão de cada um." },
];

const CASES = [
  { href: "/cases/ccr-montagens-industriais", nome: "CCR Montagens Industriais", texto: "10x de retorno no Google, medido venda por venda." },
  { href: "/cases/pantanal-auto-parts", nome: "Pantanal Auto Parts", texto: "Tempo de resposta de cada vendedor, de menos de 1 minuto a 44." },
  { href: "/cases/recanto-country", nome: "Recanto Country", texto: "Duas lojas e todos os vendedores atendendo no mesmo lugar." },
];

export default function LyidePage() {
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Lyide",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: metadata.description,
        url: `${SITE_URL}/lyide`,
        publisher: { "@type": "Organization", name: "Yide Digital", url: SITE_URL },
      },
      {
        "@type": "VideoObject",
        name: "Apresentação do Lyide, o CRM com IA da Yide",
        description: "Em 1 minuto: como o Lyide faz a empresa vender mais pelo WhatsApp.",
        thumbnailUrl: `${SITE_URL}/videos/lyide-apresentacao.jpg`,
        contentUrl: `${SITE_URL}/videos/lyide-apresentacao.mp4`,
        uploadDate: "2026-11-15",
        duration: "PT1M18S",
      },
    ],
  };

  return (
    <div className="space-y-16 sm:space-y-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />

      <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-14 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400">CRM com inteligência artificial</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">
              Lyide: do anúncio à venda fechada
            </h1>
            <p className="mt-5 text-lg text-white/65">
              O CRM da Yide que organiza o WhatsApp da sua empresa, responde o cliente em segundos com IA e mostra de onde veio cada venda.
            </p>
            <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400">
              Quero uma demonstração
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
          <div className="mx-auto w-full max-w-xs shrink-0 overflow-hidden md:mx-0 rounded-[1.75rem] border border-white/10 bg-black shadow-[0_20px_60px_-20px_rgba(45,230,230,0.35)]">
            <video
              src="/videos/lyide-apresentacao.mp4"
              poster="/videos/lyide-apresentacao.jpg"
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full"
            >
              Seu navegador não toca vídeo.
            </video>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">O que o Lyide faz pela sua empresa</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r, i) => (
            <li key={r.titulo} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <span className="text-sm font-semibold text-teal-600">{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{r.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Quem já usa</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {CASES.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="block h-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-colors hover:border-teal-300">
                <p className="font-bold text-neutral-900">{c.nome}</p>
                <p className="mt-2 text-sm text-neutral-600">{c.texto}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-teal-700">Ver case →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-4xl">Quer ver o Lyide na sua empresa?</h2>
          <p className="mt-4 text-white/65">Em 30 minutos a gente mostra o Lyide funcionando com o seu WhatsApp, sem compromisso.</p>
          <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 transition-all hover:bg-cyan-400">
            Pedir demonstração no WhatsApp
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
