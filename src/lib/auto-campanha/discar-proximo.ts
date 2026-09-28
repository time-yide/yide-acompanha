import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getApi4ComCreds, api4comFazerLigacao } from "@/lib/ligacoes/api4com";
import {
  getCampanhaHoje,
  incrementarCampanha,
  finalizarCampanha,
  temLigacaoAtivaCampanha,
  type AutoCampanhaConfig,
} from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

function agora() {
  const d = new Date();
  const cuiaba = new Date(d.toLocaleString("en-US", { timeZone: "America/Cuiaba" }));
  return cuiaba;
}

function horaStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dentroDoHorario(config: AutoCampanhaConfig): boolean {
  const h = horaStr(agora());
  return h >= config.auto_campanha_horario_inicio && h < config.auto_campanha_horario_fim;
}

interface ProximoLead {
  id: string;
  empresa: string;
  telefone: string | null;
  whatsapp: string | null;
}

async function selecionarProximoLead(orgId: string): Promise<ProximoLead | null> {
  const { data } = await sb()
    .from("leads_gerados")
    .select("id, empresa, telefone, whatsapp")
    .eq("organization_id", orgId)
    .in("status", ["novo", "em_contato", "qualificado"])
    .is("arquivado_em", null)
    .or("ai_status.is.null,ai_status.eq.aguardando")
    .or("telefone.not.is.null,whatsapp.not.is.null")
    .or(
      "ai_proxima_tentativa.is.null," +
      `ai_proxima_tentativa.lte.${new Date().toISOString()}`,
    )
    .neq("ai_status", "em_ligacao")
    .neq("ai_status", "convertido")
    .neq("ai_status", "esgotado")
    .order("score", { ascending: false })
    .order("ai_tentativas", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data as ProximoLead | null;
}

export async function discarProximoLead(
  orgId: string,
  config: AutoCampanhaConfig,
  campanhaId: string,
): Promise<{ discou: boolean; motivo?: string }> {
  if (!dentroDoHorario(config)) {
    await finalizarCampanha(campanhaId);
    return { discou: false, motivo: "fora_horario" };
  }

  const campanha = await getCampanhaHoje(orgId);
  if (!campanha || campanha.status !== "em_andamento") {
    return { discou: false, motivo: "campanha_inativa" };
  }

  if (campanha.atendidas >= config.auto_campanha_meta_atendidas) {
    await finalizarCampanha(campanhaId);
    return { discou: false, motivo: "meta_atingida" };
  }

  const creds = getApi4ComCreds();
  if (!creds) return { discou: false, motivo: "api4com_nao_configurado" };

  if (await temLigacaoAtivaCampanha(orgId)) {
    return { discou: false, motivo: "ligacao_em_andamento" };
  }

  const lead = await selecionarProximoLead(orgId);
  if (!lead) {
    await finalizarCampanha(campanhaId);
    return { discou: false, motivo: "sem_leads" };
  }

  const telefone = lead.telefone || lead.whatsapp;
  if (!telefone) return { discou: false, motivo: "lead_sem_telefone" };

  const cleaned = telefone.replace(/\D/g, "");
  const numeroPadrao = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;

  await sb()
    .from("leads_gerados")
    .update({ ai_status: "em_ligacao" })
    .eq("id", lead.id);

  const { data: lig } = await sb()
    .from("ligacoes")
    .insert({
      organization_id: orgId,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: config.power_dialer_colaborador_id,
      numero: numeroPadrao,
      contato_nome: lead.empresa,
      lead_gerado_id: lead.id,
      status: "em_andamento",
      iniciada_em: new Date().toISOString(),
      origem: "auto_campanha",
    })
    .select("id")
    .single();

  if (!lig) {
    await sb().from("leads_gerados").update({ ai_status: null }).eq("id", lead.id);
    return { discou: false, motivo: "erro_criar_ligacao" };
  }

  const ligacaoId = (lig as { id: string }).id;

  const result = await api4comFazerLigacao({
    caller: creds.defaultExtension,
    called: numeroPadrao,
    extension: creds.defaultExtension,
    metadata: {
      gateway: "yide-acompanha",
      ligacao_id: ligacaoId,
      lead_gerado_id: lead.id,
      colaborador_id: config.power_dialer_colaborador_id,
      campanha_id: campanhaId,
    },
  });

  if ("error" in result) {
    await sb().from("ligacoes")
      .update({ status: "cancelada", finalizada_em: new Date().toISOString() })
      .eq("id", ligacaoId);
    await sb().from("leads_gerados").update({ ai_status: null }).eq("id", lead.id);
    return { discou: false, motivo: result.error };
  }

  await sb().from("ligacoes")
    .update({ external_id: result.callId })
    .eq("id", ligacaoId);

  return { discou: true };
}

export async function processarFimLigacaoCampanha(
  campanhaId: string,
  orgId: string,
  atendida: boolean,
): Promise<void> {
  const { data: configData } = await sb()
    .from("ai_voice_configs")
    .select(
      "organization_id, auto_campanha_ativo, auto_campanha_meta_atendidas, " +
      "auto_campanha_horario_inicio, auto_campanha_horario_fim, power_dialer_colaborador_id",
    )
    .eq("organization_id", orgId)
    .eq("ativo", true)
    .eq("auto_campanha_ativo", true)
    .maybeSingle();

  if (!configData) return;
  const config = configData as AutoCampanhaConfig;

  const campanha = await incrementarCampanha(campanhaId, atendida);

  if (campanha.status !== "em_andamento") return;
  if (campanha.atendidas >= config.auto_campanha_meta_atendidas) {
    await finalizarCampanha(campanhaId);
    return;
  }

  await discarProximoLead(orgId, config, campanhaId);
}
