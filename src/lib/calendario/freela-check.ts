import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { freelaColidente } from "./freela-overlap";

/**
 * Erro RÍGIDO (sem override): se o videomaker tem freela reservado
 * (pega/em_negociacao/fechada, com data_hora) que sobrepõe [inicioUtc, fimUtc),
 * retorna a mensagem; senão null. Usa service-role (independe de RLS).
 */
export async function checarFreelaVideomaker(params: {
  videomakerId: string;
  nome: string;
  inicioUtc: string;
  fimUtc: string;
}): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("freela_oportunidades")
    .select("titulo, data_hora, duracao_min")
    .eq("pego_por", params.videomakerId)
    .in("status", ["pega", "em_negociacao", "fechada"])
    .not("data_hora", "is", null)
    .is("deleted_at", null)
    .lt("data_hora", params.fimUtc);
  const hit = freelaColidente(
    (data ?? []) as { titulo: string; data_hora: string; duracao_min: number }[],
    params.inicioUtc,
    params.fimUtc,
  );
  if (!hit) return null;
  const br = new Date(hit.data_hora).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return `${params.nome} tem freela reservado (${hit.titulo}) às ${br} — não dá pra delegar.`;
}
