// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";
import { derivarStatusAtual, type StatusAtual } from "./audiovisual-status";
import { getDatePartsInAppTz } from "@/lib/datetime/timezone";

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

async function _getPainelAudiovisualImpl(unitClientIds: string[] | null): Promise<CapturaPainelRow[]> {
  const supabase = createServiceRoleClient();

  // 3 dias atrás no fuso da app (Cuiabá). data_captacao é DATE (YYYY-MM-DD).
  const parts = getDatePartsInAppTz(new Date());
  const cutoff = new Date(Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10) - 3,
  ));
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb
    .from("audiovisual_capturas")
    .select(`
      id, data_captacao, qtd_videos, qtd_fotos, concluida_em, task_id,
      cliente:clients(nome),
      videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(nome),
      task:tasks!task_id(status)
    `)
    .gte("data_captacao", cutoffStr)
    .order("data_captacao", { ascending: false });

  // Multi-tenant: filtra por client_ids da unidade ativa
  if (unitClientIds !== null) {
    if (unitClientIds.length === 0) return [];
    q = q.in("client_id", unitClientIds);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return (data as CapturaMinimal[]).map((c) => {
    const { statusAtual, statusDetalhe } = derivarStatusAtual({
      concluida_em: c.concluida_em,
      task: c.task,
    });
    return {
      id: c.id,
      data_captacao: c.data_captacao,
      cliente_nome: c.cliente?.nome ?? "",
      videomaker_nome: c.videomaker?.nome ?? "",
      qtd_videos: c.qtd_videos ?? 0,
      qtd_fotos: c.qtd_fotos ?? 0,
      statusAtual,
      statusDetalhe,
      taskId: c.task_id,
    };
  });
}

export async function getPainelAudiovisual(unitClientIds: string[] | null = null): Promise<CapturaPainelRow[]> {
  const cached = unstable_cache(
    async (idsJson: string) => {
      const ids = idsJson === "null" ? null : (JSON.parse(idsJson) as string[]);
      return _getPainelAudiovisualImpl(ids);
    },
    // v2: shape ganhou filtro unit_client_ids
    ["dashboard-audiovisual-painel-v2"],
    { revalidate: 60, tags: ["dashboard", AUDIOVISUAL_CAPTURAS_TAG, "tasks"] },
  );
  return cached(unitClientIds === null ? "null" : JSON.stringify(unitClientIds));
}
