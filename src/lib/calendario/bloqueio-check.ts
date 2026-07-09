import { listBloqueiosAprovadosNaData } from "@/lib/audiovisual/bloqueios/queries";
import { bloqueiosColidem } from "@/lib/audiovisual/bloqueios/overlap";

/**
 * Retorna uma mensagem de aviso se o videomaker tem bloqueio APROVADO colidindo
 * com [horaInicioLocal, horaFimLocal) na dataLocal; null se livre.
 */
export async function checarBloqueioVideomaker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  params: { videomakerId: string; nome: string; dataLocal: string; horaInicioLocal: string; horaFimLocal: string },
): Promise<string | null> {
  const blocos = await listBloqueiosAprovadosNaData(sb, params.videomakerId, params.dataLocal);
  const hit = bloqueiosColidem(blocos, params.horaInicioLocal, params.horaFimLocal);
  if (!hit) return null;
  return `${params.nome} tem bloqueio aprovado das ${hit.hora_inicio.slice(0, 5)} às ${hit.hora_fim.slice(0, 5)} nesse dia (motivo: ${hit.motivo}).`;
}
