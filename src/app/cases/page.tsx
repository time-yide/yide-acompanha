import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getOrgPadrao } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
import { Reveal } from "@/components/site/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cases · Yide Digital",
  description: "Resultados reais de clientes da Yide Digital.",
  alternates: { canonical: "/cases" },
};

export default async function CasesIndex() {
  const orgId = await getOrgPadrao();
  const cases = orgId ? await listCasesPublicados(orgId) : [];
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 px-7 py-16 text-white sm:px-14 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-[100px]" />
        </div>
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400">Resultados reais</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-6xl">Cases</h1>
          <p className="mt-5 max-w-xl text-lg text-white/65">Resultados reais de quem confiou na Yide Digital.</p>
          <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3 text-base font-semibold text-neutral-950 shadow-[0_8px_30px_rgba(45,230,230,0.25)] transition-all hover:bg-cyan-400 hover:shadow-[0_10px_40px_rgba(45,230,230,0.4)]">
            Quero resultados assim
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
        <div className="relative z-10 mt-10 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </header>

      {cases.length === 0 ? (
        <p className="text-neutral-500">Em breve.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c, i) => (
            <Reveal key={c.slug} delay={(i % 3) * 80}>
              <Link
                href={`/cases/${c.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_18px_50px_-20px_rgba(13,148,136,0.35)]"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  {c.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-teal-100 via-cyan-50 to-neutral-100" />
                  )}
                  {c.segmento && (
                    <span className="absolute left-3 top-3 rounded-full bg-neutral-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300 backdrop-blur-sm">
                      {c.segmento}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg font-bold tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">{c.cliente}</h2>
                  {c.resultados[0] && (
                    <p className="mt-3">
                      <span className="text-2xl font-extrabold text-teal-600 [font-family:var(--font-display)]">{c.resultados[0].valor}</span>
                      <span className="ml-1.5 text-sm text-neutral-500">{c.resultados[0].rotulo}</span>
                    </p>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-teal-600">
                    Ver case
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {/* CTA final */}
      <Reveal as="section">
        <div className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-7 py-14 text-center text-white sm:px-14 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[110px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight [font-family:var(--font-display)] sm:text-4xl">Quer resultados assim?</h2>
            <p className="mt-4 text-white/65">Fale com a Yide Digital e comece a crescer sua empresa.</p>
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
