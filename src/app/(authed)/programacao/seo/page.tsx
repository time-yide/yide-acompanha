import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { garantirSeedSeo } from "@/lib/seo/seed";
import { listServicos, listLocalidades, listPaginas } from "@/lib/seo/queries";
import { GerarPendentesButton } from "@/components/seo/GerarPendentesButton";
import { PublicarPaginaButton } from "@/components/seo/PublicarPaginaButton";
import { AddLocalidadeForm } from "@/components/seo/AddLocalidadeForm";

export const dynamic = "force-dynamic";

export default async function SeoAdminPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  await garantirSeedSeo(orgId);
  const [servicos, localidades, paginas] = await Promise.all([
    listServicos(orgId),
    listLocalidades(orgId),
    listPaginas(orgId),
  ]);
  const porCelula = new Map(paginas.map((p) => [`${p.service_id}:${p.localidade_id}`, p]));

  const totalCelulas = servicos.filter((s) => s.ativo).length * localidades.filter((l) => l.ativo).length;
  const publicadas = paginas.filter((p) => p.status === "publicado").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/programacao" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Programação
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Serviços & SEO Local</h1>
          <p className="text-sm text-muted-foreground">Uma página por serviço × localidade. Gere com IA, revise e publique. {publicadas} de {totalCelulas} publicada(s).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/servicos" target="_blank" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Ver site <ExternalLink className="h-4 w-4" />
          </Link>
          <GerarPendentesButton />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar localidade</p>
        <AddLocalidadeForm />
      </div>

      {servicos.length === 0 || localidades.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Globe className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Sem serviços ou localidades ainda</p>
          <p className="text-xs text-muted-foreground">Adicione uma localidade pra começar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left font-medium">Serviço</th>
                {localidades.map((l) => (
                  <th key={l.id} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                    {l.nome}
                    <span className="ml-1 text-[10px] text-muted-foreground/70">{l.tipo === "estado" ? "UF" : l.uf}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {servicos.map((s) => (
                <tr key={s.id} className="hover:bg-muted/10">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium whitespace-nowrap">{s.nome}</td>
                  {localidades.map((l) => {
                    const pag = porCelula.get(`${s.id}:${l.id}`);
                    if (!pag) {
                      return (
                        <td key={l.id} className="px-3 py-2.5">
                          <span className="text-xs text-muted-foreground/60">—</span>
                        </td>
                      );
                    }
                    const publicado = pag.status === "publicado";
                    return (
                      <td key={l.id} className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1.5">
                          <Link href={`/programacao/seo/${pag.id}`} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                            {publicado ? "Editar" : "Revisar"}
                          </Link>
                          <PublicarPaginaButton id={pag.id} publicado={publicado} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
