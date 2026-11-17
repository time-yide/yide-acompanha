import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enviarViaTwilioWpp } from "./enviar-wpp";
import { gerarMensagemReengajamento } from "./gerar-mensagem";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

const REENGAJAMENTO_INTERVALOS_DIAS = [10, 25, 45, 10];
const MAX_REENGAJAMENTO = 4;
const MAX_REENGAJAMENTO_POR_RUN = 5;

export interface LeadReengajamento {
  id: string;
  empresa: string | null;
  telefone: string | null;
  whatsapp: string | null;
  reengajamento_tentativas: number;
}

export async function selecionarLeadsReengajamento(
  orgId: string,
): Promise<LeadReengajamento[]> {
  const now = new Date().toISOString();
  const { data } = await sb()
    .from("leads_gerados")
    .select("id, empresa, telefone, whatsapp, reengajamento_tentativas")
    .eq("organization_id", orgId)
    .eq("ai_status", "esgotado")
    .lt("reengajamento_tentativas", MAX_REENGAJAMENTO)
    .not("reengajamento_proxima", "is", null)
    .lte("reengajamento_proxima", now)
    .is("arquivado_em", null)
    .order("reengajamento_proxima", { ascending: true })
    .limit(MAX_REENGAJAMENTO_POR_RUN);
  return (data ?? []) as LeadReengajamento[];
}

export function proximoIntervaloReengajamento(
  tentativaAtual: number,
): number | null {
  if (tentativaAtual >= MAX_REENGAJAMENTO - 1) return null;
  return REENGAJAMENTO_INTERVALOS_DIAS[tentativaAtual + 1] ?? null;
}

export async function processarReengajamento(
  orgId: string,
  lead: LeadReengajamento,
  twilioWppFrom: string,
  statusUrl: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const telefone = lead.whatsapp || lead.telefone;
  if (!telefone) return { sucesso: false, erro: "Sem telefone" };

  const msgResult = await gerarMensagemReengajamento(lead.empresa ?? "");
  if ("error" in msgResult) return { sucesso: false, erro: msgResult.error };

  const result = await enviarViaTwilioWpp(
    telefone,
    twilioWppFrom,
    msgResult.mensagem,
    statusUrl,
  );
  if ("error" in result) return { sucesso: false, erro: result.error };

  const tentativa = lead.reengajamento_tentativas + 1;
  const proximoDias = proximoIntervaloReengajamento(
    lead.reengajamento_tentativas,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    reengajamento_tentativas: tentativa,
  };

  if (proximoDias !== null) {
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + proximoDias);
    updates.reengajamento_proxima = proxima.toISOString();
  } else {
    updates.ai_status = "descartado_definitivo";
    updates.reengajamento_proxima = null;
  }

  await sb().from("leads_gerados").update(updates).eq("id", lead.id);

  await sb().from("motor_prospeccao_log").insert({
    organization_id: orgId,
    lead_gerado_id: lead.id,
    acao: "reengajamento_wpp",
    modelo: "wpp_direto",
    detalhes: { mensagem: msgResult.mensagem, telefone, tentativa },
  });

  return { sucesso: true };
}
