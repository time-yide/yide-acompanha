import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { autoAssignEditor } from "@/lib/audiovisual/auto-delegate";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";

/**
 * Cron (a cada 15 min): delega automaticamente as captações paradas em
 * "Pendente edição" (sem tarefa e não concluídas). Pega o que a delegação
 * na hora da entrega não conseguiu delegar.
 *
 * Fica de fora: captação auto-marcada pelo cron D+7 (não tem material).
 * Uma de cada vez, pra contagem de carga do rodízio ir atualizando.
 */
const MAX_PER_RUN = 30;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb
    .from("audiovisual_capturas")
    .select("id, videomaker_id, observacoes")
    .is("task_id", null)
    .is("concluida_em", null)
    .order("data_captacao", { ascending: true })
    .limit(MAX_PER_RUN * 2);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pendentes = ((data ?? []) as Array<{ id: string; videomaker_id: string; observacoes: string | null }>)
    .filter((c) => !(c.observacoes ?? "").startsWith("[AUTO-MARCADA]"))
    .slice(0, MAX_PER_RUN);

  for (const c of pendentes) {
    // criado_por da tarefa precisa de alguém: usa quem gravou. Auditoria sai como sistema.
    await autoAssignEditor(c.id, c.videomaker_id, "Sistema", { sistema: true });
  }

  if (pendentes.length > 0) revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  return NextResponse.json({ tentadas: pendentes.length });
}
