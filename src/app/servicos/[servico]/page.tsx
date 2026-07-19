import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, ArrowUpRight } from "lucide-react";
import { getOrgPadrao, getServicoPublicado, listPaginasPublicadasDoServico } from "@/lib/seo/queries";
import { Reveal } from "@/components/site/Reveal";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ servico: string }> }): Promise<Metadata> {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const s = orgId ? await getServicoPublicado(orgId, servico) : null;
  if (!s) return { title: "Serviço não encontrado · Yide Digital" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv = s as any;
  return { title: `${sv.nome} · Yide Digital`, description: sv.descricao_base, alternates: { canonical: `/servicos/${sv.slug}` } };
}
export default async function ServicoAncora({ params }: { params: Promise<{ servico: string }> }) {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const s = orgId ? await getServicoPublicado(orgId, servico) : null;
  if (!s) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv = s as any;
  const paginas = await listPaginasPublicadasDoServico(orgId!, servico);
  const cidades = paginas.filter((p) => p.tipo === "cidade");
  const estados = paginas.filter((p) => p.tipo === "estado");
  const grupos: [string, typeof paginas][] = [["Cidades", cidades], ["Estados", estados]];
  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-16 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-1/4 h-[28rem] w-[28rem] translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400">Serviço</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">{sv.nome}</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/65">{sv.descricao_base}</p>
          <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
            Solicitar proposta
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
        <div className="relative z-10 mt-10 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </header>

      {/* Localidades */}
      {grupos.map(([titulo, lista]) => lista.length > 0 && (
        <section key={titulo}>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">{titulo}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((p, i) => (
              <Reveal key={p.localidadeSlug} delay={(i % 3) * 70}>
                <Link href={`/servicos/${sv.slug}/${p.localidadeSlug}`}
                  className="group flex h-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_16px_40px_-20px_rgba(13,148,136,0.35)]">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="flex-1 font-semibold text-neutral-900 group-hover:text-teal-700">{sv.nome} em {p.localidadeNome}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-600" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ))}
      {paginas.length === 0 && <p className="text-neutral-500">Páginas em breve.</p>}

      {/* CTA final */}
      <Reveal as="section">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-4xl">Pronto pra começar?</h2>
            <p className="mt-4 text-white/65">A Yide Digital cuida do seu {sv.nome.toLowerCase()} de ponta a ponta.</p>
            <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-8 py-3.5 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
              Falar no WhatsApp
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
