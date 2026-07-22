import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getResultados, listCandidatosAdicionar } from "@/lib/pesquisas/queries";
import { ResultadosView } from "@/components/pesquisas/ResultadosView";
import { ResultadosPublicosView } from "@/components/pesquisas/ResultadosPublicosView";

export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:pesquisas");

  const resultados = await getResultados(id);
  if (!resultados) notFound();

  // Rascunho: gestão vai pro editor; time não enxerga.
  if (resultados.pesquisa.status === "rascunho") {
    if (canManage) redirect(`/pesquisas/${id}/editar`);
    redirect("/pesquisas");
  }

  // Time (não-gestão): só entra se a pesquisa for pública, e vê só o agregado.
  if (!canManage) {
    if (!resultados.pesquisa.resultados_publicos) redirect("/pesquisas");
    return (
      <div className="mx-auto max-w-2xl">
        <ResultadosPublicosView
          titulo={resultados.pesquisa.titulo}
          descricao={resultados.pesquisa.descricao}
          perguntas={resultados.perguntas}
          totalRespondidos={resultados.total_respondidos}
          totalDestinatarios={resultados.total_destinatarios}
          encerrada={resultados.pesquisa.status === "encerrada"}
        />
      </div>
    );
  }

  // Gestão: visão completa (como hoje).
  const candidatos =
    resultados.pesquisa.status === "aberta" ? await listCandidatosAdicionar(id) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <ResultadosView resultados={resultados} canManage={canManage} candidatos={candidatos} />
    </div>
  );
}
