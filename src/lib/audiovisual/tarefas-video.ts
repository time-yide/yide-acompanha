import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listTasks, type TaskRow } from "@/lib/tarefas/queries";
import { AUDIOVISUAL_CAPTURAS_TAG } from "./queries";

/**
 * Tarefas de vídeo no Audiovisual.
 *
 * O fluxo "oficial" do Audiovisual nasce de uma GRAVAÇÃO (audiovisual_capturas
 * → delegação → tarefa ligada via capturas.task_id). Mas muita edição/alteração
 * é pedida direto em /tarefas (tipo "video") e não tem captura nenhuma — antes
 * ela só aparecia solta na aba "Tarefas de vídeo". Aqui separamos essas
 * "avulsas" pra entrarem também em Pendente edição / Em edição, e juntamos
 * TODA tarefa de vídeo em alteração (avulsa ou de captura) na aba Alteração.
 */

/** IDs de tarefas que já estão ligadas a alguma captura (fluxo de gravação). */
async function listTaskIdsLigadasACaptura(): Promise<Set<string>> {
  const cached = unstable_cache(
    async () => {
      const sb = createServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from("audiovisual_capturas")
        .select("task_id")
        .not("task_id", "is", null);
      return ((data ?? []) as Array<{ task_id: string }>).map((r) => r.task_id);
    },
    ["audiovisual-capturas-task-ids-v1"],
    { revalidate: 30, tags: [AUDIOVISUAL_CAPTURAS_TAG, "tasks"] },
  );
  return new Set(await cached());
}

/**
 * Tarefas de vídeo pedidas por /tarefas (sem captura), num status específico.
 * - "aberta"       → ainda não começou  → aba Pendente edição
 * - "em_andamento" → editor trabalhando → aba Em edição
 */
export async function listTarefasVideoAvulsas(
  status: "aberta" | "em_andamento",
  unitClientIds: string[] | null,
): Promise<TaskRow[]> {
  const [tasks, ligadas] = await Promise.all([
    listTasks({ tipo: ["video"], status: [status], unitClientIds }),
    listTaskIdsLigadasACaptura(),
  ]);
  return tasks.filter((t) => !ligadas.has(t.id));
}

/** Toda tarefa de vídeo em alteração (avulsa ou vinda de captura). */
export async function listTarefasVideoEmAlteracao(
  unitClientIds: string[] | null,
): Promise<TaskRow[]> {
  return listTasks({ tipo: ["video"], status: ["alteracao"], unitClientIds });
}
