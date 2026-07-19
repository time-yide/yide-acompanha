import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getOrgPadrao, getServicoPublicado, listPaginasPublicadasDoServico } from "@/lib/seo/queries";
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
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">{sv.nome}</h1>
        <p className="mt-3 text-lg text-neutral-600">{sv.descricao_base}</p>
      </header>
      {grupos.map(([titulo, lista]) => lista.length > 0 && (
        <section key={titulo}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">{titulo}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((p) => (
              <Link key={p.localidadeSlug} href={`/servicos/${sv.slug}/${p.localidadeSlug}`}
                className="group flex items-center gap-2 rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <MapPin className="h-4 w-4 text-teal-600" />
                <span className="font-medium group-hover:text-teal-700">{sv.nome} em {p.localidadeNome}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {paginas.length === 0 && <p className="text-neutral-500">Páginas em breve.</p>}
    </div>
  );
}
