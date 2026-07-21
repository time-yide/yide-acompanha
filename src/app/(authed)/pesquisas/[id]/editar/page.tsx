import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess, ROLE_LABELS } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPesquisaComPerguntas } from "@/lib/pesquisas/queries";
import { PesquisaBuilder } from "@/components/pesquisas/PesquisaBuilder";
import type { PublicoOptions } from "@/components/pesquisas/DispararModal";

async function loadPublicoOptions(): Promise<PublicoOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const [{ data: unidades }, { data: pessoas }] = await Promise.all([
    sb.from("units").select("id, nome").order("nome"),
    sb.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  // Cargos: os roles reais (exclui o legado "coordenador" da UI de escolha).
  const cargos = (Object.keys(ROLE_LABELS) as string[])
    .filter((r) => r !== "coordenador")
    .map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  return {
    cargos,
    unidades: (unidades ?? []) as { id: string; nome: string }[],
    pessoas: (pessoas ?? []) as { id: string; nome: string }[],
  };
}

export default async function EditarPesquisaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:pesquisas")) redirect("/pesquisas");

  const data = await getPesquisaComPerguntas(id);
  if (!data) notFound();
  if (data.pesquisa.status !== "rascunho") redirect(`/pesquisas/${id}`);

  const opcoesPublico = await loadPublicoOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{data.pesquisa.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {data.pesquisa.anonima ? "Anônima · " : ""}Monte as perguntas e dispare pro time.
        </p>
      </header>
      <PesquisaBuilder pesquisaId={id} perguntasIniciais={data.perguntas} opcoesPublico={opcoesPublico} />
    </div>
  );
}
