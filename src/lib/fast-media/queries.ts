// SERVER ONLY: demandas (gravações + tarefas) dos Fast Mídia pra aba /fast-media.
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getProximasGravacoes, type GravacaoRow } from "@/lib/dashboard/personal";
import { listTasks, type TaskRow } from "@/lib/tarefas/queries";

// Gestão que vê as demandas de TODOS os Fast Mídia. Fast Mídia comum vê as dele.
const MANAGER_ROLES = ["adm", "socio", "coordenador", "audiovisual_chefe"];

export interface FastMidiaDemanda {
  id: string;
  nome: string;
  gravacoes: GravacaoRow[];
  /** Tarefas em aberto (não concluídas/postadas). */
  tarefas: TaskRow[];
}

/**
 * Demandas dos Fast Mídia: próximas gravações (2 semanas) + tarefas em aberto.
 * - Gestão (adm/sócio/coordenador/audiovisual_chefe): vê de todos os Fast Mídia.
 * - Fast Mídia: vê só as próprias.
 */
export async function getFastMidiaDemandas(
  viewerId: string,
  viewerRole: string,
): Promise<FastMidiaDemanda[]> {
  const isManager = MANAGER_ROLES.includes(viewerRole);
  const supabase = createServiceRoleClient();

  let people: Array<{ id: string; nome: string }>;
  if (isManager) {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("role", "fast_midia")
      .eq("ativo", true)
      .order("nome");
    people = (data ?? []) as Array<{ id: string; nome: string }>;
  } else {
    const { data } = await supabase.from("profiles").select("id, nome").eq("id", viewerId).maybeSingle();
    people = data ? [data as { id: string; nome: string }] : [];
  }
  if (people.length === 0) return [];

  const now = new Date();
  const fromIso = now.toISOString();
  const to = new Date(now);
  to.setDate(to.getDate() + 14);
  const toIso = to.toISOString();

  return Promise.all(
    people.map(async (p) => {
      const [gravacoes, allTasks] = await Promise.all([
        getProximasGravacoes(p.id, fromIso, toIso),
        listTasks({ atribuidoA: p.id }),
      ]);
      const tarefas = allTasks.filter((t) => t.status !== "concluida" && t.status !== "postada");
      return { id: p.id, nome: p.nome, gravacoes, tarefas };
    }),
  );
}
