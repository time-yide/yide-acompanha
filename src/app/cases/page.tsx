import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadrao } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";

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
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Cases</h1>
        <p className="mt-3 max-w-xl text-neutral-600">Resultados reais de quem confiou na Yide Digital.</p>
      </header>
      {cases.length === 0 ? (
        <p className="text-neutral-500">Em breve.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Link
              key={c.slug}
              href={`/cases/${c.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {c.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover" />
              ) : (
                <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-100 to-neutral-100" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">{c.segmento || "Case"}</span>
                <h2 className="mt-1 text-lg font-bold tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">{c.cliente}</h2>
                {c.resultados[0] && (
                  <p className="mt-2 text-sm text-neutral-600">
                    <span className="font-bold text-neutral-900">{c.resultados[0].valor}</span> {c.resultados[0].rotulo}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
