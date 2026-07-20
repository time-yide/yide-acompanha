import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listPostsPresenca, getChecklistFeitos } from "@/lib/presenca/queries";
import { getContasEAnalisesYide } from "@/lib/presenca/contas";
import { CANAIS, type Canal } from "@/lib/presenca/config";
import type { PostRow } from "@/lib/presenca/queries";
import type { ContaCanal } from "@/lib/presenca/contas";
import { PresencaWorkspace } from "@/components/presenca/PresencaWorkspace";

export const dynamic = "force-dynamic";

export default async function PresencaPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const [entradas, resultadoContas] = await Promise.all([
    Promise.all(
      CANAIS.map(async ({ value }) => {
        const [posts, feitos] = await Promise.all([
          listPostsPresenca(orgId, value),
          getChecklistFeitos(orgId, value),
        ]);
        return [value, { posts, feitos }] as const;
      }),
    ),
    getContasEAnalisesYide(orgId),
  ]);
  const dados = Object.fromEntries(entradas) as Record<Canal, { posts: PostRow[]; feitos: string[] }>;

  const semClienteYide = resultadoContas.semCliente;
  const contasPorCanal = resultadoContas.semCliente
    ? ({} as Record<Canal, ContaCanal>)
    : (Object.fromEntries(resultadoContas.contas.map((c) => [c.canal, c])) as Record<Canal, ContaCanal>);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presença &amp; Autoridade</h1>
        <p className="text-sm text-muted-foreground">Otimize os canais da Yide (Google Meu Negócio, LinkedIn, redes sociais e blogs) pra ranquear melhor no Google e ser citada por IA.</p>
      </div>
      <PresencaWorkspace dados={dados} contasPorCanal={contasPorCanal} semClienteYide={semClienteYide} />
    </div>
  );
}
