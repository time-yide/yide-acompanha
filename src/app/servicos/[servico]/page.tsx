import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, ArrowUpRight, Check } from "lucide-react";
import { getOrgPadrao, getServicoOuSeed, listPaginasPublicadasDoServico } from "@/lib/seo/queries";
import { conteudoDoServico } from "@/lib/site/servicos-conteudo";
import { jsonLdServicoNacional } from "@/lib/seo/schema";
import { SITE_URL } from "@/lib/blog/config";
import { Reveal } from "@/components/site/Reveal";
import { FaqAberto } from "@/components/site/FaqAberto";
import { WHATSAPP_SITE } from "@/lib/site/contato";
import { CidadeVisitante } from "@/components/site/CidadeVisitante";
import { paginasLocaisDoServico } from "@/lib/site/paginas-locais";
import { cidadePorSlug } from "@/lib/site/cidades";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ servico: string }> }): Promise<Metadata> {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const s = await getServicoOuSeed(orgId, servico);
  if (!s) return { title: "Serviço não encontrado · Yide Digital" };
  const c = conteudoDoServico(s.slug);
  return {
    title: c?.metaTitulo ?? `${s.nome} · Yide Digital`,
    description: c?.metaDescricao ?? s.descricao_base,
    alternates: { canonical: `/servicos/${s.slug}` },
  };
}

export default async function ServicoAncora({ params }: { params: Promise<{ servico: string }> }) {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const sv = await getServicoOuSeed(orgId, servico);
  if (!sv) notFound();
  const c = conteudoDoServico(sv.slug);
  const doBanco = orgId ? await listPaginasPublicadasDoServico(orgId, servico) : [];
  const doCodigo = paginasLocaisDoServico(sv.slug).map((p) => ({ localidadeSlug: p.cidade, localidadeNome: cidadePorSlug(p.cidade)?.nome ?? p.cidade }));
  const paginas = [...doCodigo, ...doBanco.filter((b) => !doCodigo.some((c) => c.localidadeSlug === b.localidadeSlug))];
  const url = `${SITE_URL}/servicos/${sv.slug}`;
  const jsonLd = JSON.stringify(
    jsonLdServicoNacional({ nome: sv.nome, descricao: c?.resposta ?? sv.descricao_base, url, faq: c?.faq ?? [] }),
  ).replace(/</g, "\\u003c");

  return (
    <div className="space-y-16 sm:space-y-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <div className="space-y-6">
        <nav aria-label="Você está em" className="text-sm text-neutral-500">
          <Link href="/" className="hover:text-teal-700">Início</Link> <span aria-hidden>›</span>{" "}
          <Link href="/servicos" className="hover:text-teal-700">Serviços</Link> <span aria-hidden>›</span>{" "}
          <span className="text-neutral-800">{sv.nome}</span>
        </nav>

        {/* Hero com a resposta direta */}
        <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-14 text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 right-1/4 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
            <div className="absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />
          </div>
          <div className="relative max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400">{sv.nome}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">
              {c?.titulo ?? sv.nome}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{c?.resposta ?? sv.descricao_base}</p>
            <p className="mt-4 text-sm font-medium text-cyan-300">
              Atendemos empresas de <CidadeVisitante padrao="Cuiabá, Várzea Grande, todo o Mato Grosso e o Brasil" comCidade="{cidade} e de todo o Mato Grosso" />.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400">
                Falar no WhatsApp
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <Link href="/diagnostico" className="inline-flex items-center rounded-full border border-white/20 px-7 py-3 text-base font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white">
                Pedir diagnóstico grátis
              </Link>
            </div>
          </div>
        </header>
      </div>

      {c && (
        <>
          <section className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">O que está incluído</h2>
              <p className="mt-3 text-neutral-600">Tudo o que a Yide faz em {sv.nome}.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.entregas.map((e) => (
                <li key={e} className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                  <span className="text-neutral-800">{e}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Como funciona</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.etapas.map((e, i) => (
                <li key={e.titulo} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <span className="text-sm font-semibold text-teal-600">Etapa {i + 1}</span>
                  <h3 className="mt-2 text-lg font-bold text-neutral-900">{e.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{e.texto}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-neutral-200 sm:p-12">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Para quem é</h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {c.paraQuem.map((p) => (
                <li key={p} className="rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">{p}</li>
              ))}
            </ul>
            <p className="mt-6 text-neutral-600">
              A Yide fica em Cuiabá e atende Cuiabá, Várzea Grande, todo o Mato Grosso e empresas de outros estados com reuniões online.
            </p>
          </section>
        </>
      )}

      {paginas.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight [font-family:var(--font-display)]">{sv.nome} por cidade</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginas.map((p, i) => (
              <Reveal key={p.localidadeSlug} delay={(i % 3) * 70}>
                <Link href={`/servicos/${sv.slug}/${p.localidadeSlug}`}
                  className="group flex h-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="flex-1 font-semibold text-neutral-900 group-hover:text-teal-700">{sv.nome} em {p.localidadeNome}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {c && c.faq.length > 0 && (
        <section className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)]">Perguntas frequentes</h2>
          <div className="mt-6"><FaqAberto itens={c.faq} /></div>
        </section>
      )}

      <section>
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-4xl">Vamos conversar sobre a sua empresa<CidadeVisitante padrao="" comCidade=" em {cidade}" />?</h2>
            <p className="mt-4 text-white/65">Diagnóstico gratuito e resposta no mesmo dia. Atendimento 24 horas.</p>
            <a href={WHATSAPP_SITE} target="_blank" rel="noopener noreferrer"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 transition-all hover:bg-cyan-400">
              Falar no WhatsApp
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
