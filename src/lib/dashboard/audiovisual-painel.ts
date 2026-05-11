// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";
import { derivarStatusAtual, type StatusAtual } from "./audiovisual-status";

export { derivarStatusAtual, type StatusAtual } from "./audiovisual-status";

export interface CapturaPainelRow {
  id: string;
  data_captacao: string;
  cliente_nome: string;
  videomaker_nome: string;
  qtd_videos: number;
  qtd_fotos: number;
  statusAtual: StatusAtual;
  statusDetalhe: string | null;
  taskId: string | null;
}

interface CapturaMinimal {
  id: string;
  data_captacao: string;
  qtd_videos: number | null;
  qtd_fotos: number | null;
  concluida_em: string | null;
  task_id: string | null;
  cliente: { nome: string } | null;
  videomaker: { nome: string } | null;
  task: { status: string } | null;
}

async function _getPainelAudiovisualImpl(): Promise<CapturaPainelRow[]> {
  const supabase = createServiceRoleClient();

  // 3 dias atrás em BRT. data_captacao é DATE (YYYY-MM-DD).
  const ref = new Date();
  const brtNow = new Date(ref.getTime() - 3 * 60 * 60 * 1000);
  const cutoffDate = new Date(brtNow);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 3);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("audiovisual_capturas")
    .select(`
      id, data_captacao, qtd_videos, qtd_fotos, concluida_em, task_id,
      cliente:clients(nome),
      videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(nome),
      task:tasks!task_id(status)
    `)
    .gte("data_captacao", cutoffStr)
    .order("data_captacao", { ascending: false });

  if (error || !data) return [];

  return (data as CapturaMinimal[]).map((c) => {
    const { statusAtual, statusDetalhe } = derivarStatusAtual({
      concluida_em: c.concluida_em,
      task: c.task,
    });
    return {
      id: c.id,
      data_captacao: c.data_captacao,
      cliente_nome: c.cliente?.nome ?? "—",
      videomaker_nome: c.videomaker?.nome ?? "—",
      qtd_videos: c.qtd_videos ?? 0,
      qtd_fotos: c.qtd_fotos ?? 0,
      statusAtual,
      statusDetalhe,
      taskId: c.task_id,
    };
  });
}

export async function getPainelAudiovisual(): Promise<CapturaPainelRow[]> {
  const cached = unstable_cache(
    _getPainelAudiovisualImpl,
    ["dashboard-audiovisual-painel-v1"],
    { revalidate: 60, tags: ["dashboard", AUDIOVISUAL_CAPTURAS_TAG, "tasks"] },
  );
  return cached();
}
