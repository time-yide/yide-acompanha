import Link from "next/link";
import { MapPin, ArrowUpRight, Check } from "lucide-react";
import type { PaginaLocal } from "@/lib/site/paginas-locais";
import { paginasLocaisDoServico } from "@/lib/site/paginas-locais";
import type { Cidade } from "@/lib/site/cidades";
import { CIDADES } from "@/lib/site/cidades";
import type { ConteudoServico } from "@/lib/site/servicos-conteudo";
import { jsonLdServicoLocal } from "@/lib/seo/schema";
import { YIDE_NAP } from "@/lib/seo/config";
import { WHATSAPP_SITE } from "@/lib/site/contato";
import { FaqAberto } from "./FaqAberto";

interface Props {
  pagina: PaginaLocal;
  cidade: Cidade;
  servicoNome: string;
  servico: ConteudoServico | null;
  url: string;
}

/** Página serviço × cidade com conteúdo próprio da praça (texto escrito, não modelo). */
export function PaginaCidade({ pagina, cidade, servicoNome, servico, url }: Props) {
  const faq = [...pagina.faq, ...(servico?.faq.slice(0, 2) ?? [])];
  const ld = jsonLdServicoLocal({ servicoNome, descricao: pagina.resposta, url, localidadeNome: cidade.nome, tipo: cidade.tipo, uf: cidade.uf, faq });
  ld["@graph"].push({ "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: `${YIDE_NAP.site}/` },
    { "@type": "ListItem", position: 2, name: servicoNome, item: `${YIDE_NAP.site}/servicos/${pagina.servico}` },
    { "@type": "ListItem", position: 3, name: cidade.nome, item: url },
  ] });
  const jsonLd = JSON.stringify(ld).replace(/</g, "\\u003c");
  const outrasCidades = paginasLocaisDoServico(pagina.servico).filter((p) => p.cidade !== cidade.slug);

  return (
    <div className="space-y-16 sm:space-y-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <div className="space-y-6">
        <nav aria-label="Você está em" className="text-sm text-neutral-500">
          <Link href="/" className="hover:text-teal-700">Início</Link> <span aria-hidden>›</span>{" "}
          <Link href={`/servicos/${pagina.servico}`} className="hover:text-teal-700">{servicoNome}</Link> <span aria-hidden>›</span>{" "}
          <span className="text-neutral-800">{cidade.nome}</span>
        </nav>

        <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-14 text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal-500/20 blur-[120px]" />
            <div className="absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-[100px]" />
          </div>
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {cidade.nome} · {cidade.uf}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{pagina.titulo}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{pagina.resposta}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 transition-all hover:bg-cyan-400">
                Falar no WhatsApp <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
              <Link href="/diagnostico" className="inline-flex items-center rounded-full border border-white/20 px-7 py-3 text-base font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white">
                Pedir diagnóstico grátis
              </Link>
            </div>
          </div>
        </header>
      </div>

      <section className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">{servicoNome} em {cidade.nome}: o que muda</h2>
          {pagina.contexto.map((p) => <p key={p.slice(0, 40)} className="text-lg leading-relaxed text-neutral-700">{p}</p>)}
        </div>
        <aside className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">Como a Yide atende {cidade.tipo === "estado" ? "o estado" : "a cidade"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{cidade.atendimento}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="font-semibold text-neutral-900">{cidade.nome}</dt><dd className="text-neutral-600">{cidade.resumo} {cidade.populacao[0].toUpperCase() + cidade.populacao.slice(1)}.</dd></div>
          </dl>
        </aside>
      </section>

      <section>
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">O que fazemos em {cidade.nome}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {pagina.focos.map((f) => (
            <li key={f} className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
              <span className="text-neutral-800">{f}</span>
            </li>
          ))}
        </ul>
        {servico && (
          <p className="mt-5 text-neutral-600">
            Além disso, o serviço inclui: {servico.entregas.slice(0, 3).join("; ").toLowerCase()}.{" "}
            <Link href={`/servicos/${pagina.servico}`} className="font-semibold text-teal-700 hover:underline">Ver tudo sobre {servicoNome}</Link>
          </p>
        )}
      </section>

      <section className="grid gap-8 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-neutral-200 sm:p-12 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight [font-family:var(--font-display)]">{cidade.tipo === "estado" ? "Cidades atendidas" : "Regiões atendidas"}</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {cidade.regioes.map((r) => <li key={r} className="rounded-full bg-neutral-100 px-3.5 py-1.5 text-sm text-neutral-700">{r}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight [font-family:var(--font-display)]">Segmentos que atendemos</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {cidade.segmentos.map((s) => <li key={s} className="rounded-full bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800">{s}</li>)}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Perguntas frequentes</h2>
        <div className="mt-6"><FaqAberto itens={faq} /></div>
      </section>

      {outrasCidades.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">{servicoNome} em outras praças</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {outrasCidades.map((p) => {
              const c = CIDADES.find((x) => x.slug === p.cidade)!;
              return (
                <li key={p.cidade}>
                  <Link href={`/servicos/${p.servico}/${p.cidade}`} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:border-teal-300 hover:text-teal-700">
                    <MapPin className="h-4 w-4 text-teal-600" aria-hidden /> {c.nome}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Vamos crescer sua empresa em {cidade.nome}?</h2>
            <p className="mt-4 text-white/65">Diagnóstico gratuito, resposta no mesmo dia e atendimento 24 horas.</p>
            <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 transition-all hover:bg-cyan-400">
              Falar no WhatsApp <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
