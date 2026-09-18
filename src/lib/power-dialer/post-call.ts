import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

/**
 * Processamento pós-chamada do Power Dialer: limpa o status do lead,
 * registra a tentativa e espelha a ligação na tabela `ligacoes` (mesmo
 * padrão do voz-ia/post-call.ts) pra aparecer no dashboard de Ligações.
 */
export async function processPowerDialerPostCall(
  batchId: string,
  orgId: string,
  leadGeradoId: string,
  durationSeconds: number,
) {
  // Busca o batch pra pegar gravação + colaborador
  const { data: batch } = await sb()
    .from("power_dialer_batches")
    .select("gravacao_url, gravacao_sid, colaborador_id")
    .eq("id", batchId)
    .single();

  // Limpa status do lead
  await sb().from("leads_gerados").update({
    ai_status: null,
    dropado_power_dialer: false,
  }).eq("id", leadGeradoId);

  // Registra tentativa
  try {
    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "ligacao",
      canal: "telefone",
      notas: "Power Dialer — ligação com agente",
    });
  } catch { /* ignore */ }

  // Espelha na tabela ligacoes
  const { data: lead } = await sb()
    .from("leads_gerados")
    .select("telefone, empresa")
    .eq("id", leadGeradoId)
    .single();

  if (lead?.telefone) {
    const now = new Date();
    try {
      await sb().from("ligacoes").insert({
        organization_id: orgId,
        colaborador_id: batch?.colaborador_id ?? null,
        tipo: "telefone",
        numero: lead.telefone,
        contato_nome: lead.empresa ?? null,
        direcao: "saida",
        status: durationSeconds > 5 ? "atendida" : "perdida",
        iniciada_em: new Date(now.getTime() - durationSeconds * 1000).toISOString(),
        finalizada_em: now.toISOString(),
        duracao_segundos: durationSeconds,
        gravacao_url: batch?.gravacao_url ?? null,
        origem: "power_dialer",
        lead_gerado_id: leadGeradoId,
        tags: ["power_dialer"],
      });
    } catch (err) {
      console.error("[power-dialer] erro ao espelhar ligação:", err);
    }
  }
}
