import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { isHorarioComercial } from "./categorias";
import { selecionarLeads, contarWppEnviadosHoje, getOrgsComMotorAtivo } from "./selecao";
import { gerarMensagemPrimeiroContato } from "./gerar-mensagem";
import { getStepsDaCadencia, calcularStepAtual, seedCadenciaPadrao } from "./cadencia";
import { normalizeTelefone } from "@/lib/dispatch/render-template";
import { dispararLigacaoIA, contarLigacoesHoje } from "@/lib/voz-ia/ligacao-automatica";
import type { LeadParaProspectar, MotorResult, MotorGlobalResult } from "./types";
import { MOTOR_BATCH_SIZE, MOTOR_INTERVALO_MIN_HORAS } from "./types";

function sb() {
  return createServiceRoleClient() as any;
}

async function findOrCreateConversation(
  orgId: string,
  telefone: string,
  twilioFrom: string,
  leadId: string,
  empresa: string,
  configId: string | null,
): Promise<string | null> {
  const { data: existing } = await sb()
    .from("wpp_conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contato_telefone", telefone)
    .maybeSingle();

  if (existing) {
    await sb()
      .from("wpp_conversations")
      .update({ ai_ativa: true, ai_config_id: configId })
      .eq("id", (existing as any).id);
    return (existing as any).id;
  }

  const { data: conv } = await sb()
    .from("wpp_conversations")
    .insert({
      organization_id: orgId,
      contato_nome: empresa,
      contato_telefone: telefone,
      canal: "whatsapp",
      lead_gerado_id: leadId,
      twilio_from: twilioFrom,
      nao_lidas: 0,
      ai_ativa: true,
      ai_config_id: configId,
    })
    .select("id")
    .single();

  return conv?.id ?? null;
}

async function enviarViaTwilio(
  to: string,
  from: string,
  body: string,
  statusCallbackUrl: string,
): Promise<{ sid: string } | { error: string }> {
  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { error: "Twilio não configurado" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${from}`,
    To: `whatsapp:${to}`,
    Body: body,
    StatusCallback: statusCallbackUrl,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `Twilio ${resp.status}: ${text.slice(0, 200)}` };
  }

  const result = await resp.json();
  return { sid: (result as { sid?: string }).sid ?? "" };
}

async function processarLead(
  orgId: string,
  lead: LeadParaProspectar,
  config: any,
  statusUrl: string,
  podeLigar: boolean,
): Promise<{ acao: string; erro?: string }> {
  // Check cadência step
  await seedCadenciaPadrao(config.id);
  const steps = await getStepsDaCadencia(config.id);
  const step = calcularStepAtual(lead.ai_tentativas, steps);

  if (!step) {
    await sb()
      .from("leads_gerados")
      .update({ ai_status: "esgotado" })
      .eq("id", lead.id);
    return { acao: "esgotado" };
  }

  if (step.canal === "ligacao") {
    if (!podeLigar) {
      return { acao: "ligacao_limite", erro: "Limite diário de ligações atingido" };
    }

    const telefoneRaw = lead.telefone || lead.whatsapp;
    if (!telefoneRaw) return { acao: "erro", erro: "Sem telefone para ligação" };

    const resultado = await dispararLigacaoIA(orgId, lead.id);

    if ("error" in resultado) {
      await sb().from("motor_prospeccao_log").insert({
        organization_id: orgId,
        lead_gerado_id: lead.id,
        acao: "ligacao_erro",
        modelo: "voz_ia",
        detalhes: { erro: resultado.error, step_ordem: step.ordem },
      });
      return { acao: "erro", erro: resultado.error };
    }

    const proximaTentativa = new Date();
    proximaTentativa.setDate(proximaTentativa.getDate() + (step.dias_apos_anterior || 2));

    await sb()
      .from("leads_gerados")
      .update({
        ai_tentativas: lead.ai_tentativas + 1,
        ai_proxima_tentativa: proximaTentativa.toISOString(),
      })
      .eq("id", lead.id);

    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: lead.id,
      tipo: "ligacao",
      canal: "ligacao",
      notas: "Motor de prospecção — ligação IA automática",
    }).catch(() => {});

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: lead.id,
      acao: "ligacao_ia",
      modelo: "voz_ia",
      detalhes: { call_id: resultado.callId, step_ordem: step.ordem },
    });

    return { acao: "ligacao_ia" };
  }

  // --- WhatsApp flow ---
  const telefoneRaw = lead.whatsapp || lead.telefone;
  if (!telefoneRaw) return { acao: "erro", erro: "Sem telefone/whatsapp" };

  const telefone = normalizeTelefone(telefoneRaw);
  if (!telefone) return { acao: "erro", erro: `Telefone inválido: ${telefoneRaw}` };

  const twilioFrom = config.twilio_wpp_from;
  if (!twilioFrom) return { acao: "erro", erro: "twilio_wpp_from não configurado" };

  let promptOverride = config.wpp_primeiro_contato_prompt;
  if (step.template_tipo === "followup") {
    promptOverride = `Você é da Yide Digital. Já mandou mensagem pra esse lead antes mas ele não respondeu. Mande um follow-up curto e amigável. Máximo 2 linhas. Mencione algo novo ou diferente. Não repita a mesma mensagem.`;
  } else if (step.template_tipo === "ultimo") {
    promptOverride = `Você é da Yide Digital. Esta é a ÚLTIMA tentativa de contato com esse lead. Mande uma mensagem final, curta e respeitosa. Diga que é a última mensagem e que está à disposição se mudar de ideia. Máximo 2 linhas.`;
  }

  const msgResult = await gerarMensagemPrimeiroContato(lead, promptOverride);
  if ("error" in msgResult) return { acao: "erro", erro: msgResult.error };

  const convId = await findOrCreateConversation(
    orgId, telefone, twilioFrom, lead.id, lead.empresa, config.id,
  );
  if (!convId) return { acao: "erro", erro: "Falha ao criar conversa" };

  const sendResult = await enviarViaTwilio(telefone, twilioFrom, msgResult.mensagem, statusUrl);
  if ("error" in sendResult) return { acao: "erro", erro: sendResult.error };

  await sb().from("wpp_messages").insert({
    conversation_id: convId,
    organization_id: orgId,
    autor: "sistema",
    texto: msgResult.mensagem,
    twilio_sid: sendResult.sid,
    status: "enviada",
  });

  await sb()
    .from("wpp_conversations")
    .update({
      ultimo_texto: msgResult.mensagem.slice(0, 200),
      ultima_msg_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", convId);

  const proximaTentativa = new Date();
  proximaTentativa.setHours(proximaTentativa.getHours() + MOTOR_INTERVALO_MIN_HORAS);

  const leadUpdate: Record<string, unknown> = {
    ai_tentativas: lead.ai_tentativas + 1,
    ai_proxima_tentativa: proximaTentativa.toISOString(),
    ai_status: "followup_wpp",
  };
  if (lead.ai_tentativas === 0) leadUpdate.status = "em_contato";

  await sb()
    .from("leads_gerados")
    .update(leadUpdate)
    .eq("id", lead.id);

  await sb().from("lead_attempts").insert({
    organization_id: orgId,
    lead_gerado_id: lead.id,
    tipo: "whatsapp",
    canal: "whatsapp",
    notas: "Motor de prospecção — WPP automático",
  }).catch(() => {});

  await sb().from("motor_prospeccao_log").insert({
    organization_id: orgId,
    lead_gerado_id: lead.id,
    acao: "wpp_primeiro_contato",
    modelo: "wpp_direto",
    detalhes: {
      mensagem: msgResult.mensagem,
      telefone,
      conversation_id: convId,
      twilio_sid: sendResult.sid,
    },
  });

  return { acao: "wpp_primeiro_contato" };
}

export async function executarMotor(): Promise<MotorGlobalResult> {
  const env = getServerEnv();
  const statusUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wpp/twilio/status`;
  const now = new Date();

  const result: MotorGlobalResult = {
    orgs: 0,
    totalProcessados: 0,
    totalWpp: 0,
    totalLigacoes: 0,
    totalErros: 0,
    porOrg: [],
  };

  const orgs = await getOrgsComMotorAtivo();
  result.orgs = orgs.length;
  if (orgs.length === 0) return result;

  for (const { organization_id: orgId, config } of orgs) {
    if (!isHorarioComercial(now, config)) continue;

    const wppHoje = await contarWppEnviadosHoje(orgId);
    const wppRestante = Math.max(0, (config.max_wpp_dia ?? 50) - wppHoje);
    if (wppRestante === 0) continue;

    const batch = Math.min(MOTOR_BATCH_SIZE, wppRestante);
    const leads = await selecionarLeads(orgId, config.max_tentativas, batch);

    const ligacoesHoje = await contarLigacoesHoje(orgId);
    const maxLigacoes = config.max_chamadas_dia ?? 30;
    let ligacoesRestantes = Math.max(0, maxLigacoes - ligacoesHoje);

    const orgResult: MotorResult = {
      orgId,
      processados: 0,
      wppEnviados: 0,
      ligacoesDisparadas: 0,
      erros: 0,
      detalhes: [],
    };

    for (const lead of leads) {
      orgResult.processados++;
      try {
        const res = await processarLead(orgId, lead, config, statusUrl, ligacoesRestantes > 0);
        if (res.acao === "wpp_primeiro_contato") {
          orgResult.wppEnviados++;
        } else if (res.acao === "ligacao_ia") {
          orgResult.ligacoesDisparadas++;
          ligacoesRestantes--;
        } else if (res.acao === "erro") {
          orgResult.erros++;
          await sb().from("motor_prospeccao_log").insert({
            organization_id: orgId,
            lead_gerado_id: lead.id,
            acao: "erro",
            modelo: "wpp_direto",
            detalhes: { erro: res.erro },
          });
        }
        orgResult.detalhes.push({ leadId: lead.id, acao: res.acao, erro: res.erro });
      } catch (err) {
        orgResult.erros++;
        const msg = err instanceof Error ? err.message : String(err);
        orgResult.detalhes.push({ leadId: lead.id, acao: "erro", erro: msg });
      }
    }

    result.totalProcessados += orgResult.processados;
    result.totalWpp += orgResult.wppEnviados;
    result.totalLigacoes += orgResult.ligacoesDisparadas;
    result.totalErros += orgResult.erros;
    result.porOrg.push(orgResult);
  }

  return result;
}
