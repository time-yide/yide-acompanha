import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getApi4ComCreds, api4comFazerLigacao } from "@/lib/ligacoes/api4com";
import { sendWebPushToUser } from "@/lib/push/server";
import {
  getCampanhaHoje,
  incrementarCampanha,
  finalizarCampanha,
  temLigacaoAtivaCampanha,
  type AutoCampanhaConfig,
} from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

const DELAY_PREPARAR_MS = 15_000;

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

function limparTelefone(t: string | null): string {
  if (!t) return "";
  return t.replace(/\D/g, "").replace(/^55/, "");
}

async function getTelefonesClientes(orgId: string): Promise<Set<string>> {
  const { data } = await sb()
    .from("clients")
    .select("telefone")
    .eq("organization_id", orgId)
    .not("telefone", "is", null);

  const set = new Set<string>();
  for (const c of data ?? []) {
    const clean = limparTelefone(c.telefone);
    if (clean.length >= 8) set.add(clean);
  }
  return set;
}

async function selecionarProximoLead(orgId: string): Promise<ProximoLead | null> {
  const telefonesClientes = await getTelefonesClientes(orgId);

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
    .order("score", { ascending: false })
    .order("ai_tentativas", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);

  if (!data || data.length === 0) return null;

  // Excluir leads cujo telefone já é de um cliente (ativo ou churn)
  for (const lead of data as ProximoLead[]) {
    const tel = limparTelefone(lead.telefone) || limparTelefone(lead.whatsapp);
    if (tel && telefonesClientes.has(tel)) continue;
    return lead;
  }

  return null;
}

async function notificarColaborador(
  colaboradorId: string | null,
  title: string,
  body: string,
): Promise<void> {
  if (!colaboradorId) return;
  try {
    await sendWebPushToUser(colaboradorId, {
      title,
      body,
      url: "/ligacoes",
      tag: "auto-campanha",
      urgent: true,
    });
  } catch {
    // push is best-effort
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function discarProximoLead(
  orgId: string,
  config: AutoCampanhaConfig,
  campanhaId: string,
  opts?: { aguardarAbertura?: boolean },
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
    await notificarColaborador(
      config.power_dialer_colaborador_id,
      "Meta atingida!",
      `${campanha.atendidas}/${config.auto_campanha_meta_atendidas} atendidas hoje. Campanha concluida.`,
    );
    return { discou: false, motivo: "meta_atingida" };
  }

  const creds = getApi4ComCreds();
  if (!creds) return { discou: false, motivo: "api4com_nao_configurado" };

  if (await temLigacaoAtivaCampanha(orgId)) {
    return { discou: false, motivo: "ligacao_em_andamento" };
  }

  const lead = await selecionarProximoLead(orgId);
  if (!lead) {
    return { discou: false, motivo: "sem_leads_aguardando" };
  }

  const telefone = lead.telefone || lead.whatsapp;
  if (!telefone) return { discou: false, motivo: "lead_sem_telefone" };

  const cleaned = telefone.replace(/\D/g, "");
  const numeroPadrao = cleaned.startsWith("55") ? `+${cleaned}` : `+55${cleaned}`;

  // Quando vem do cron, o app pode estar em background no celular.
  // Push + delay de 15s dá tempo pro Lucas abrir e o JsSIP reconectar.
  if (opts?.aguardarAbertura) {
    await notificarColaborador(
      config.power_dialer_colaborador_id,
      "Preparando ligação...",
      `${lead.empresa} — abra o app pra atender.`,
    );
    await delay(DELAY_PREPARAR_MS);
  }

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
  contatoNome?: string,
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

  if (atendida) {
    await notificarColaborador(
      config.power_dialer_colaborador_id,
      "Lead atendeu!",
      contatoNome
        ? `${contatoNome} atendeu. ${campanha.atendidas}/${config.auto_campanha_meta_atendidas} atendidas.`
        : `${campanha.atendidas}/${config.auto_campanha_meta_atendidas} atendidas hoje.`,
    );
  }

  if (campanha.status !== "em_andamento") return;
  if (campanha.atendidas >= config.auto_campanha_meta_atendidas) {
    await finalizarCampanha(campanhaId);
    await notificarColaborador(
      config.power_dialer_colaborador_id,
      "Meta atingida!",
      `${campanha.atendidas}/${config.auto_campanha_meta_atendidas} atendidas hoje. Campanha concluida.`,
    );
    return;
  }

  // Encadeando após uma ligação — Lucas já está com o app aberto, sem delay
  await discarProximoLead(orgId, config, campanhaId);
}
