import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, BarChart3, Code2, Share2, Database, Megaphone, Sparkles, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getOrgPadrao, listServicosComPaginas } from "@/lib/seo/queries";
import { Reveal } from "@/components/site/Reveal";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Serviços · Yide Digital",
  description: "Marketing, tráfego, sites e IA para empresas em Cuiabá, Salvador, Vila Velha e região.",
  alternates: { canonical: "/servicos" } };

const ICONS: LucideIcon[] = [BarChart3, Code2, Share2, Database, Megaphone, Sparkles];
// Bento: 1º card grande, 4º ocupa 2 colunas — mesmo ritmo da home.
const SPANS = ["sm:col-span-2 sm:row-span-2", "", "", "sm:col-span-2", "", ""];
const PRACAS = ["Cuiabá", "Várzea Grande", "Salvador", "Vila Velha"];

export default async function ServicosIndex() {
  const orgId = await getOrgPadrao();
  const servicos = orgId ? await listServicosComPaginas(orgId) : [];
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-16 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/4 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400">O que fazemos</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">
            Serviços que movem o ponteiro
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/65">
            Marketing, tráfego, sites e IA para empresas de Cuiabá, Várzea Grande, Salvador, Vila Velha e além.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
              Falar no WhatsApp
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <Link href="/cases" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3 text-base font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white">
              Ver cases
            </Link>
          </div>
        </div>
        <div className="relative z-10 mt-10 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </header>

      {/* Grid bento de serviços */}
      {servicos.length > 0 && (
        <section>
          <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 sm:grid-cols-3">
            {servicos.map((s, i) => {
              const Icon = ICONS[i % ICONS.length];
              const span = SPANS[i % SPANS.length];
              const grande = span.includes("row-span-2");
              return (
                <Reveal key={s.id} delay={(i % 3) * 80} className={span}>
                  <Link href={`/servicos/${s.slug}`}
                    className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_18px_50px_-20px_rgba(13,148,136,0.35)]">
                    <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal-500/5 blur-2xl transition-all group-hover:bg-teal-500/10" />
                    <div className="relative">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                        <Icon className="h-6 w-6" />
                      </span>
                    </div>
                    <div className="relative mt-6">
                      <h2 className={`font-bold tracking-tight text-neutral-900 [font-family:var(--font-display)] group-hover:text-teal-700 ${grande ? "text-2xl" : "text-xl"}`}>{s.nome}</h2>
                      <p className={`mt-2 leading-relaxed text-neutral-500 ${grande ? "text-base" : "text-sm"}`}>{s.descricao_base}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
                        Ver mais
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* Faixa de praças atendidas */}
      <Reveal as="section">
        <div className="rounded-[1.75rem] border border-teal-100/80 bg-gradient-to-br from-teal-50 via-cyan-50/40 to-[#faf9f7] px-7 py-10 sm:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-600">Praças atendidas</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {PRACAS.map((cidade) => (
              <span key={cidade} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/70 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm">
                <MapPin className="h-4 w-4 text-teal-600" /> {cidade}
              </span>
            ))}
            <span className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-neutral-500">e além</span>
          </div>
        </div>
      </Reveal>

      {/* CTA final */}
      <Reveal as="section">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-4xl">Vamos crescer sua empresa?</h2>
            <p className="mt-4 text-white/65">A Yide Digital cuida do seu marketing, tráfego, site e IA de ponta a ponta.</p>
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
