import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listCasesAdmin } from "@/lib/seo/case-queries";
import { NovoCaseButton } from "@/components/seo/NovoCaseButton";
import { PublicarCaseButton } from "@/components/seo/PublicarCaseButton";

export const dynamic = "force-dynamic";

export default async function CasesAdminPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const cases = await listCasesAdmin(orgId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/programacao/seo" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Serviços & SEO Local
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">Resultados reais de clientes. Preencha os dados, a IA pole o texto, revise e publique.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cases" target="_blank" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            Ver cases <ExternalLink className="h-4 w-4" />
          </Link>
          <NovoCaseButton />
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum case ainda</p>
          <p className="text-xs text-muted-foreground">Clique em &ldquo;Novo case&rdquo; pra começar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Cliente</th>
                <th className="px-4 py-2 text-left font-medium">Segmento</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.map((c) => {
                const publicado = c.status === "publicado";
                return (
                  <tr key={c.id} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium">{c.cliente}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.segmento || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold ${publicado ? "text-emerald-500" : "text-amber-500"}`}>
                        {publicado ? "Publicado" : "Rascunho"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/programacao/seo/cases/${c.id}`} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                          Editar
                        </Link>
                        <PublicarCaseButton id={c.id} publicado={publicado} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
