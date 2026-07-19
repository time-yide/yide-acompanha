import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadrao, listServicosComPaginas } from "@/lib/seo/queries";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Serviços · Yide Digital",
  description: "Marketing, tráfego, sites e IA para empresas em Cuiabá, Salvador, Vila Velha e região.",
  alternates: { canonical: "/servicos" } };
export default async function ServicosIndex() {
  const orgId = await getOrgPadrao();
  const servicos = orgId ? await listServicosComPaginas(orgId) : [];
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Nossos serviços</h1>
        <p className="mt-3 max-w-xl text-neutral-600">Marketing, tráfego, sites e IA para empresas de Cuiabá, Várzea Grande, Salvador, Vila Velha e além.</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {servicos.map((s) => (
          <Link key={s.id} href={`/servicos/${s.slug}`} className="group rounded-2xl border border-neutral-200/90 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <h2 className="text-xl font-bold tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">{s.nome}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.descricao_base}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-teal-600">Ver mais →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
