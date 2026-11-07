import Link from "next/link";
import type { Metadata } from "next";
import { YIDE_NAP, SEED_SERVICOS } from "@/lib/seo/config";
import { WHATSAPP_SITE } from "@/lib/site/contato";

export const metadata: Metadata = {
  title: "Sobre a Yide Digital | Agência de marketing, vendas e IA em Cuiabá",
  description: "A Yide Digital é uma agência de marketing, vendas e IA em Cuiabá, MT. +100 clientes ativos e +R$ 18 milhões em anúncios geridos, com atendimento em todo o Brasil.",
  alternates: { canonical: "/sobre" },
};

const NUMEROS = [
  { valor: "+100", rotulo: "clientes ativos" },
  { valor: "+R$ 18 mi", rotulo: "em anúncios geridos" },
  { valor: "24h", rotulo: "de atendimento" },
  { valor: "5+", rotulo: "anos de estrada" },
];

const METODO = [
  { titulo: "Atrair", texto: "Anúncios no Google e no Instagram, conteúdo, vídeos e presença no Google para trazer quem já procura o que você vende." },
  { titulo: "Atender", texto: "O lead cai no Lyide, o CRM com IA da Yide, que responde em segundos, qualifica e passa para o seu time." },
  { titulo: "Vender", texto: "Funil, follow-up automático e relatório que mostra qual anúncio trouxe cada venda." },
];

export default function SobrePage() {
  return (
    <div className="space-y-16 sm:space-y-24">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-700">Sobre a Yide</p>
        <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">
          Agência de marketing, vendas e IA em Cuiabá, para todo o Brasil
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-700">
          A Yide Digital ajuda empresas a terem mais clientes chamando no WhatsApp, todo mês. Cuidamos dos anúncios, do conteúdo,
          dos vídeos e do site, e entregamos junto o Lyide, o CRM com inteligência artificial que responde cada contato em segundos.
          A sede fica em Cuiabá, Mato Grosso, e atendemos empresas de todo o Brasil.
        </p>
      </header>

      <section aria-label="Números da Yide" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
        {NUMEROS.map((n) => (
          <div key={n.rotulo} className="bg-white p-6">
            <p className="text-3xl font-extrabold tracking-tight text-neutral-900 [font-family:var(--font-display)] tabular-nums">{n.valor}</p>
            <p className="mt-1 text-sm text-neutral-600">{n.rotulo}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">O método Yide</h2>
        <p className="mt-3 max-w-2xl text-neutral-600">Do anúncio à venda, sem buraco no meio. Três etapas, uma equipe só.</p>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {METODO.map((m, i) => (
            <li key={m.titulo} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <span className="text-sm font-semibold text-teal-600">{i + 1}</span>
              <h3 className="mt-2 text-xl font-bold">{m.titulo}</h3>
              <p className="mt-2 text-neutral-600">{m.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">O que fazemos</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEED_SERVICOS.map((s) => (
            <li key={s.slug}>
              <Link href={`/servicos/${s.slug}`} className="block h-full rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-300">
                <span className="font-semibold text-neutral-900">{s.nome}</span>
                <span className="mt-1 block text-sm text-neutral-600">{s.descricao_base}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 rounded-[2rem] bg-neutral-950 p-8 text-white sm:p-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Onde estamos</h2>
          <address className="mt-6 space-y-1 not-italic text-white/75">
            <p className="font-semibold text-white">{YIDE_NAP.nome}</p>
            <p>{YIDE_NAP.rua}</p>
            <p>{YIDE_NAP.cidade} · {YIDE_NAP.uf} · {YIDE_NAP.cep}</p>
            <p>WhatsApp {YIDE_NAP.telefone}</p>
            <p>{YIDE_NAP.email}</p>
            <p>CNPJ 48.380.404/0001-84</p>
            <p>Atendimento 24 horas, todos os dias</p>
          </address>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-teal-500 px-7 py-3 font-semibold text-neutral-950 transition-colors hover:bg-cyan-400">
            Falar no WhatsApp
          </a>
          <a href="https://maps.google.com/?cid=14243144777750195365" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3 font-semibold text-white/85 transition-colors hover:border-white/40">
            Ver no Google Maps
          </a>
        </div>
      </section>
    </div>
  );
}
