import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getResultados, listCandidatosAdicionar } from "@/lib/pesquisas/queries";
import { ResultadosView } from "@/components/pesquisas/ResultadosView";

export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:pesquisas");
  if (!canManage) redirect("/pesquisas");

  const resultados = await getResultados(id);
  if (!resultados) notFound();
  if (resultados.pesquisa.status === "rascunho") redirect(`/pesquisas/${id}/editar`);

  // Candidatos a adicionar (quem entrou depois do disparo) — só faz sentido se aberta.
  const candidatos =
    resultados.pesquisa.status === "aberta" ? await listCandidatosAdicionar(id) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <ResultadosView resultados={resultados} canManage={canManage} candidatos={candidatos} />
    </div>
  );
}
