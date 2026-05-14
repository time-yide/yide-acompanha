"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  createLeadSchema, editLeadSchema, moveStageSchema, markLostSchema, deleteLeadSchema,
  canInteractWithStage, type Stage,
} from "./schema";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { inferTipoPacote } from "@/lib/clientes/schema";
import { PROSPECTS_CACHE_TAG } from "@/lib/prospeccao/queries";
import { LEADS_CACHE_TAG } from "./queries";
import { getTodayDate } from "@/lib/datetime/timezone";
import { brtInputToUtcIso, formatBrtDate } from "@/lib/calendario/timezone";

/**
 * Converte `datetime-local` string ("YYYY-MM-DDTHH:mm") pra ISO UTC,
 * interpretando o wall-clock no fuso da app (Cuiabá UTC-4). Retorna null
 * pra string vazia/inválida. Use em TODOS os campos timestamptz vindos de
 * input datetime-local pra garantir consistência entre colaboradores.
 */
function datetimeLocalToUtcOrNull(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  try {
    return brtInputToUtcIso(value);
  } catch {
    return null;
  }
}

function prettyStage(stage: string): string {
  switch (stage) {
    case "leads_potencial": return "Leads em potencial";
    case "leads_ativos": return "Leads ativos";
    case "proposta_enviada": return "Proposta enviada";
    case "reuniao_comercial": return "Reunião comercial";
    case "contrato": return "Contrato";
    case "marco_zero": return "Marco zero";
    case "ativo": return "Ativação do lead";
    // Legados (caso de algum lead não migrado)
    case "prospeccao": return "Leads ativos";
    case "comercial": return "Reunião comercial";
    default: return stage;
  }
}

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}


export async function createLeadAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio", "comercial"].includes(actor.role)) {
    return { error: "Apenas Comercial, ADM ou Sócio podem criar leads" };
  }

  const parsed = createLeadSchema.safeParse({
    nome_prospect: fd(formData, "nome_prospect"),
    site: fd(formData, "site") ?? "",
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_proposto: fd(formData, "valor_proposto") ?? 0,
    duracao_meses: fd(formData, "duracao_meses"),
    servico_proposto: fd(formData, "servico_proposto"),
    link_proposta: fd(formData, "link_proposta") ?? "",
    info_briefing: fd(formData, "info_briefing"),
    prioridade: fd(formData, "prioridade") || "media",
    data_prospeccao_agendada: fd(formData, "data_prospeccao_agendada"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    nome_prospect: parsed.data.nome_prospect,
    site: parsed.data.site || null,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_proposto: parsed.data.valor_proposto,
    duracao_meses: parsed.data.duracao_meses ?? null,
    servico_proposto: parsed.data.servico_proposto || null,
    link_proposta: parsed.data.link_proposta || null,
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: datetimeLocalToUtcOrNull(parsed.data.data_prospeccao_agendada),
    stage: "leads_potencial" as const,
    comercial_id: actor.id,
  };

  // Cast: types do Supabase ainda não conhecem os novos valores do enum lead_stage.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar lead" };

  await sb.from("lead_history").insert({
    lead_id: created.id,
    from_stage: null,
    to_stage: "leads_potencial",
    ator_id: actor.id,
    observacao: "Lead criado",
  });

  await logAudit({
    entidade: "leads",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload,
    ator_id: actor.id,
  });

  // Se já vem com data agendada, notifica prospeccao_agendada
  if (parsed.data.data_prospeccao_agendada) {
    await dispatchNotification({
      evento_tipo: "prospeccao_agendada",
      titulo: "Prospecção agendada",
      mensagem: `${parsed.data.nome_prospect} · ${formatBrtDate(datetimeLocalToUtcOrNull(parsed.data.data_prospeccao_agendada) ?? parsed.data.data_prospeccao_agendada)}`,
      link: `/onboarding/${created.id}`,
      source_user_id: actor.id,
    });
  }

  revalidatePath("/onboarding");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  redirect(`/onboarding/${created.id}`);
}

export async function updateLeadAction(formData: FormData) {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!before) return { error: "Lead não encontrado" };

  const parsed = editLeadSchema.safeParse({
    id,
    nome_prospect: fd(formData, "nome_prospect"),
    site: fd(formData, "site") ?? "",
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_proposto: fd(formData, "valor_proposto") ?? 0,
    duracao_meses: fd(formData, "duracao_meses"),
    servico_proposto: fd(formData, "servico_proposto"),
    link_proposta: fd(formData, "link_proposta") ?? "",
    info_briefing: fd(formData, "info_briefing"),
    prioridade: fd(formData, "prioridade") || "media",
    data_prospeccao_agendada: fd(formData, "data_prospeccao_agendada"),
    data_reuniao_marco_zero: fd(formData, "data_reuniao_marco_zero"),
    coord_alocado_id: fd(formData, "coord_alocado_id"),
    assessor_alocado_id: fd(formData, "assessor_alocado_id"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updatePayload = {
    nome_prospect: parsed.data.nome_prospect,
    site: parsed.data.site || null,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_proposto: parsed.data.valor_proposto,
    duracao_meses: parsed.data.duracao_meses ?? null,
    servico_proposto: parsed.data.servico_proposto || null,
    link_proposta: parsed.data.link_proposta || null,
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: datetimeLocalToUtcOrNull(parsed.data.data_prospeccao_agendada),
    data_reuniao_marco_zero: datetimeLocalToUtcOrNull(parsed.data.data_reuniao_marco_zero),
    coord_alocado_id: parsed.data.coord_alocado_id || null,
    assessor_alocado_id: parsed.data.assessor_alocado_id || null,
  };

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "leads",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  redirect(`/onboarding/${id}`);
}

export async function moveStageAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = moveStageSchema.safeParse({
    id: fd(formData, "id"),
    to_stage: fd(formData, "to_stage"),
    observacao: fd(formData, "observacao") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Campos que o TransitionDialog pode mandar pra preencher antes de mover.
  // Quando vêm, atualizamos o lead PRIMEIRO e revalidamos a regra contra
  // os valores novos (ex.: valor_proposto recém-preenchido).
  const inlineTelefone = fd(formData, "telefone");
  const inlineValor = fd(formData, "valor_proposto");
  const inlineDuracao = fd(formData, "duracao_meses");
  const inlineServico = fd(formData, "servico_proposto");
  const inlineLinkProposta = fd(formData, "link_proposta");
  const inlineDataReuniao = fd(formData, "data_prospeccao_agendada");
  const inlineDataMarcoZero = fd(formData, "data_reuniao_marco_zero");

  const supabase = await createClient();
  const { data: leadInitial } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!leadInitial) return { error: "Lead não encontrado" };

  const fromStage = leadInitial.stage as Stage;
  const toStage = parsed.data.to_stage;

  // Permissão por estágio (ver STAGE_INTERACTORS em schema.ts)
  if (!canInteractWithStage(actor.role, fromStage)) {
    return { error: `Seu papel não tem permissão pra mexer em cards na fase "${fromStage}"` };
  }

  // 1. Aplica updates inline (do TransitionDialog) antes de validar transições.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inlineUpdate: any = {};
  if (inlineTelefone !== undefined) inlineUpdate.telefone = inlineTelefone || null;
  if (inlineValor !== undefined) inlineUpdate.valor_proposto = Number(inlineValor) || 0;
  if (inlineDuracao !== undefined) {
    const n = Number(inlineDuracao);
    inlineUpdate.duracao_meses = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (inlineServico !== undefined) inlineUpdate.servico_proposto = inlineServico || null;
  if (inlineLinkProposta !== undefined) inlineUpdate.link_proposta = inlineLinkProposta || null;
  if (inlineDataReuniao !== undefined) inlineUpdate.data_prospeccao_agendada = datetimeLocalToUtcOrNull(inlineDataReuniao);
  if (inlineDataMarcoZero !== undefined) inlineUpdate.data_reuniao_marco_zero = datetimeLocalToUtcOrNull(inlineDataMarcoZero);

  if (Object.keys(inlineUpdate).length > 0) {
    const { error: inlineErr } = await supabase
      .from("leads")
      .update(inlineUpdate)
      .eq("id", parsed.data.id);
    if (inlineErr) return { error: inlineErr.message };
  }

  // Recarrega lead com os campos novos pra validar a transição.
  const { data: lead } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!lead) return { error: "Lead não encontrado" };

  // Regras de transição

  // leads_potencial → leads_ativos: lead frio precisa ter telefone pra virar
  // ativo (sem telefone não dá pra avançar contato).
  if (fromStage === "leads_potencial" && toStage === "leads_ativos") {
    if (!lead.telefone || String(lead.telefone).trim() === "") {
      return { error: "Preencha o telefone pra mover pra Leads ativos" };
    }
  }

  // leads_ativos → reuniao_comercial: precisa de data/hora da reunião.
  // Cria evento no calendário interno depois do move (ver bloco mais abaixo).
  if (fromStage === "leads_ativos" && toStage === "reuniao_comercial") {
    if (!lead.data_prospeccao_agendada) {
      return { error: "Agende a data e horário da reunião comercial antes de mover" };
    }
  }

  // reuniao_comercial → proposta_enviada: precisa ter valor da proposta
  // cadastrado E link da proposta (Drive/Notion/Docs etc.) pra time
  // poder rastrear o documento enviado ao cliente.
  if (fromStage === "reuniao_comercial" && toStage === "proposta_enviada") {
    const valor = Number(lead.valor_proposto ?? 0);
    if (valor <= 0) {
      return { error: "Preencha o valor da proposta antes de mover" };
    }
    if (!lead.link_proposta || String(lead.link_proposta).trim() === "") {
      return { error: "Informe o link da proposta antes de mover" };
    }
  }

  // proposta_enviada → contrato: confirma valor e serviço/especificações
  // do que foi fechado.
  if (fromStage === "proposta_enviada" && toStage === "contrato") {
    const valor = Number(lead.valor_proposto ?? 0);
    if (valor <= 0) {
      return { error: "Confirme o valor fechado antes de mover pra Contrato" };
    }
    if (!lead.servico_proposto || String(lead.servico_proposto).trim() === "") {
      return { error: "Preencha o serviço/especificações fechadas antes de mover pra Contrato" };
    }
  }

  if (toStage === "marco_zero" && !lead.data_reuniao_marco_zero) {
    return { error: "Preencha 'Data da reunião de marco zero' antes de mover" };
  }

  if (toStage === "ativo") {
    if (!lead.coord_alocado_id || !lead.assessor_alocado_id) {
      return { error: "Aloque coordenador e assessor antes de ativar o cliente" };
    }
    if (lead.stage !== "marco_zero") {
      return { error: "Só é possível ativar a partir do estágio Marco Zero" };
    }
    if (!canInteractWithStage(actor.role, "ativo")) {
      return { error: "Apenas Sócio, Coord ou Assessor ativam o cliente após marco zero" };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = { stage: toStage };

  // Cria o cliente assim que entra em marco_zero (mesmo sem coord/assessor
  // alocados ainda — esses ficam null e serão preenchidos antes da ativação).
  // Cliente nasce com status='em_onboarding' — entra na lista de /clientes,
  // mas NÃO conta na carteira ativa nem em comissão até virar status=ativo.
  if (toStage === "marco_zero" && !lead.client_id) {
    const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
    if (!org) return { error: "Organização não encontrada" };

    const today = getTodayDate();
    const { data: newClient, error: clientErr } = await supabase
      .from("clients")
      .insert({
        organization_id: org.id,
        nome: lead.nome_prospect,
        contato_principal: lead.contato_principal,
        email: lead.email,
        telefone: lead.telefone,
        valor_mensal: lead.valor_proposto,
        servico_contratado: lead.servico_proposto,
        status: "em_onboarding",
        data_entrada: today,
        assessor_id: lead.assessor_alocado_id ?? null,
        coordenador_id: lead.coord_alocado_id ?? null,
        tipo_pacote: inferTipoPacote(lead.servico_proposto),
      })
      .select("id")
      .single();

    if (clientErr || !newClient) return { error: clientErr?.message ?? "Falha ao criar cliente" };

    updatePayload.client_id = newClient.id;
  }

  if (toStage === "ativo") {
    const today = getTodayDate();

    if (lead.client_id) {
      // Cliente já foi criado em marco_zero. Apenas promove pra status='ativo'
      // e sincroniza coord/assessor (se mudaram entre marco_zero e ativo).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbAny = supabase as any;
      const { error: clientUpdErr } = await sbAny
        .from("clients")
        .update({
          status: "ativo",
          assessor_id: lead.assessor_alocado_id,
          coordenador_id: lead.coord_alocado_id,
        })
        .eq("id", lead.client_id);
      if (clientUpdErr) return { error: clientUpdErr.message };
    } else {
      // Fallback pra leads legados que pularam direto pra ativo sem passar
      // por marco_zero (não deveria acontecer no fluxo novo, mas garante
      // compat com cards antigos).
      const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
      if (!org) return { error: "Organização não encontrada" };

      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          organization_id: org.id,
          nome: lead.nome_prospect,
          contato_principal: lead.contato_principal,
          email: lead.email,
          telefone: lead.telefone,
          valor_mensal: lead.valor_proposto,
          servico_contratado: lead.servico_proposto,
          status: "ativo",
          data_entrada: today,
          assessor_id: lead.assessor_alocado_id,
          coordenador_id: lead.coord_alocado_id,
          tipo_pacote: inferTipoPacote(lead.servico_proposto),
        })
        .select("id")
        .single();

      if (clientErr || !newClient) return { error: clientErr?.message ?? "Falha ao criar cliente" };
      updatePayload.client_id = newClient.id;
    }

    updatePayload.data_fechamento = today;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("leads").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await sb.from("lead_history").insert({
    lead_id: parsed.data.id,
    from_stage: fromStage,
    to_stage: toStage,
    ator_id: actor.id,
    observacao: parsed.data.observacao ?? null,
  });

  // Quando o card entra em "reuniao_comercial", cria evento no calendário
  // interno (sub_calendar=onboarding). Best-effort: falha aqui não desfaz
  // o move — só loga e segue.
  if (toStage === "reuniao_comercial" && lead.data_prospeccao_agendada) {
    try {
      const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
      if (org) {
        const inicio = new Date(lead.data_prospeccao_agendada);
        const fim = new Date(inicio.getTime() + 60 * 60 * 1000); // 1h default
        const participantes = [actor.id, lead.comercial_id].filter(
          (v, i, arr) => v && arr.indexOf(v) === i,
        );
        await sb.from("calendar_events").insert({
          organization_id: org.id,
          titulo: `Reunião comercial · ${lead.nome_prospect}`,
          descricao: lead.servico_proposto
            ? `Proposta: ${lead.servico_proposto}`
            : null,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          sub_calendar: "onboarding",
          criado_por: actor.id,
          participantes_ids: participantes,
          lead_id: lead.id,
        });
        revalidatePath("/calendario");
      }
    } catch {
      // Falha de calendário não desfaz a transição.
    }
  }

  await logAudit({
    entidade: "leads",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: { stage: fromStage },
    dados_depois: updatePayload,
    ator_id: actor.id,
    justificativa: parsed.data.observacao,
  });

  revalidatePath("/onboarding");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  revalidatePath(`/onboarding/${parsed.data.id}`);
  // Cliente é criado em marco_zero (status=em_onboarding) e promovido em
  // ativo. Em ambos casos, /clientes muda e o dashboard precisa refletir.
  if (toStage === "marco_zero" || toStage === "ativo") {
    revalidatePath("/clientes");
    revalidateTag("dashboard", "default");
    revalidateTag("clients", "default");
  }

  // kanban_moved (sempre)
  const nextResponsibleId =
    (toStage === "leads_ativos" || toStage === "reuniao_comercial" || toStage === "proposta_enviada") ? lead.comercial_id :
    toStage === "marco_zero" ? lead.coord_alocado_id :
    toStage === "ativo" ? lead.assessor_alocado_id :
    null;

  await dispatchNotification({
    evento_tipo: "kanban_moved",
    titulo: `Card movido para "${prettyStage(toStage)}"`,
    mensagem: `${actor.nome} moveu "${lead.nome_prospect}"`,
    link: `/onboarding/${parsed.data.id}`,
    source_user_id: actor.id,
    user_ids_extras: nextResponsibleId ? [nextResponsibleId] : undefined,
  });

  // deal_fechado (só quando move pra ativo)
  if (toStage === "ativo") {
    await dispatchNotification({
      evento_tipo: "deal_fechado",
      titulo: `Deal fechado: ${lead.nome_prospect}`,
      mensagem: `${actor.nome} marcou ${lead.nome_prospect} como cliente ativo`,
      link: `/clientes/${updatePayload.client_id}`,
      source_user_id: actor.id,
    });
  }

  return { success: `Movido para ${toStage}` };
}

export async function markLostAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = markLostSchema.safeParse({
    id: fd(formData, "id"),
    motivo_perdido: fd(formData, "motivo_perdido"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!lead) return { error: "Lead não encontrado" };

  // Mesma regra do moveStage — papel precisa interagir com o estágio atual
  if (!canInteractWithStage(actor.role, lead.stage as Stage)) {
    return { error: `Seu papel não tem permissão pra marcar como perdido nesta fase` };
  }

  const { error } = await supabase
    .from("leads")
    .update({ motivo_perdido: parsed.data.motivo_perdido })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await supabase.from("lead_history").insert({
    lead_id: parsed.data.id,
    from_stage: lead.stage,
    to_stage: lead.stage,
    ator_id: actor.id,
    observacao: `Marcado como perdido: ${parsed.data.motivo_perdido}`,
  });

  await logAudit({
    entidade: "leads",
    entidade_id: parsed.data.id,
    acao: "soft_delete",
    dados_depois: { motivo_perdido: parsed.data.motivo_perdido },
    ator_id: actor.id,
    justificativa: parsed.data.motivo_perdido,
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/perdidos");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  return { success: "Lead marcado como perdido" };
}

/**
 * Restaura um lead que foi marcado como perdido — volta pro kanban no mesmo
 * estágio que ele estava. Limpa motivo_perdido e registra no histórico.
 *
 * Permissão: mesma do markLost (precisa poder interagir com o estágio atual).
 */
export async function restoreLeadAction(formData: FormData) {
  const actor = await requireAuth();
  const id = fd(formData, "id");
  if (!id) return { error: "ID do lead obrigatório" };

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) return { error: "Lead não encontrado" };
  if (!lead.motivo_perdido) return { error: "Lead já está ativo no kanban" };

  if (!canInteractWithStage(actor.role, lead.stage as Stage)) {
    return { error: `Seu papel não tem permissão pra restaurar leads neste estágio` };
  }

  const motivoAnterior = lead.motivo_perdido;

  const { error } = await supabase
    .from("leads")
    .update({ motivo_perdido: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("lead_history").insert({
    lead_id: id,
    from_stage: lead.stage,
    to_stage: lead.stage,
    ator_id: actor.id,
    observacao: `Restaurado do "perdido" (motivo anterior: ${motivoAnterior})`,
  });

  await logAudit({
    entidade: "leads",
    entidade_id: id,
    acao: "update",
    dados_antes: { motivo_perdido: motivoAnterior },
    dados_depois: { motivo_perdido: null },
    ator_id: actor.id,
    justificativa: "Restaurado de perdidos",
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/perdidos");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  return { success: "Lead restaurado" };
}

/**
 * Hard delete de um lead/card do onboarding.
 * Permissão: socio OU criador do lead (comercial_id).
 *
 * Audita ANTES de deletar pra preservar histórico completo. FKs em
 * lead_history, lead_attempts, calendar_events.lead_id já têm cascade/set null
 * configurado pelas migrations.
 */
export async function deleteLeadAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = deleteLeadSchema.safeParse({
    id: fd(formData, "id"),
    justificativa: fd(formData, "justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", parsed.data.id)
    .single();
  if (!lead) return { error: "Lead não encontrado" };

  const isPriv = actor.role === "socio" || actor.role === "adm";
  const isCreator = actor.id === lead.comercial_id;
  if (!isPriv && !isCreator) {
    return { error: "Apenas sócio, ADM ou o criador do card pode excluir" };
  }

  // Lead já virou cliente — exclusão precisa ser feita pelo /clientes
  // (commission_snapshots referenciam lead_id sem cascade).
  if (lead.stage === "ativo" || lead.client_id) {
    return { error: "Lead já virou cliente. Use a página de clientes pra excluir." };
  }

  await logAudit({
    entidade: "leads",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: lead as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  // Soft delete: recuperável via /lixeira por 30 dias.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: deleted, error } = await sb
    .from("leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Falha ao excluir: lead não foi removido (verifique permissões)" };
  }

  revalidatePath("/onboarding");
  revalidateTag(PROSPECTS_CACHE_TAG, "default");
  revalidateTag(LEADS_CACHE_TAG, "default");
  return { success: true as const };
}
