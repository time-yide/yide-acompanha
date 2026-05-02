"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  createLeadSchema, editLeadSchema, moveStageSchema, markLostSchema, type Stage,
} from "./schema";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { inferTipoPacote } from "@/lib/clientes/schema";

function prettyStage(stage: string): string {
  switch (stage) {
    case "prospeccao": return "Prospecção";
    case "comercial": return "Reunião Comercial";
    case "contrato": return "Contrato";
    case "marco_zero": return "Marco Zero";
    case "ativo": return "Cliente Ativo";
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
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: parsed.data.data_prospeccao_agendada || null,
    stage: "prospeccao" as const,
    comercial_id: actor.id,
  };

  const { data: created, error } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar lead" };

  await supabase.from("lead_history").insert({
    lead_id: created.id,
    from_stage: null,
    to_stage: "prospeccao",
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
      mensagem: `${parsed.data.nome_prospect} — ${new Date(parsed.data.data_prospeccao_agendada).toLocaleDateString("pt-BR")}`,
      link: `/onboarding/${created.id}`,
      source_user_id: actor.id,
    });
  }

  revalidatePath("/onboarding");
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
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: parsed.data.data_prospeccao_agendada || null,
    data_reuniao_marco_zero: parsed.data.data_reuniao_marco_zero || null,
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

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!lead) return { error: "Lead não encontrado" };

  const fromStage = lead.stage as Stage;
  const toStage = parsed.data.to_stage;

  // Regras de transição
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
    if (!["adm", "socio", "coordenador"].includes(actor.role)) {
      return { error: "Apenas Coord, ADM ou Sócio ativam o cliente após marco zero" };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = { stage: toStage };

  if (toStage === "ativo") {
    const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
    if (!org) return { error: "Organização não encontrada" };

    const today = new Date().toISOString().slice(0, 10);
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
    updatePayload.data_fechamento = today;
  }

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await supabase.from("lead_history").insert({
    lead_id: parsed.data.id,
    from_stage: fromStage,
    to_stage: toStage,
    ator_id: actor.id,
    observacao: parsed.data.observacao ?? null,
  });

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
  revalidatePath(`/onboarding/${parsed.data.id}`);
  if (toStage === "ativo") revalidatePath("/clientes");

  // kanban_moved (sempre)
  const nextResponsibleId =
    toStage === "comercial" ? lead.comercial_id :
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
  return { success: "Lead marcado como perdido" };
}
