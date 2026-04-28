"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import {
  agendarReuniaoSchema,
  marcarPerdidoSchema,
  addAttemptSchema,
} from "./schema";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

export async function agendarReuniaoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = agendarReuniaoSchema.safeParse({
    lead_id: formData.get("lead_id"),
    tipo: formData.get("tipo"),
    data_hora: formData.get("data_hora"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: leadData } = await supabase
    .from("leads")
    .select("id, nome_prospect, organization_id")
    .eq("id", parsed.data.lead_id)
    .single();
  if (!leadData) return { error: "Lead não encontrado" };

  const lead = leadData as { id: string; nome_prospect: string; organization_id: string };

  const tituloEvento = parsed.data.tipo === "marco_zero"
    ? `Marco zero — ${lead.nome_prospect}`
    : `Reunião com ${lead.nome_prospect}`;

  const fimDataHora = new Date(new Date(parsed.data.data_hora).getTime() + 60 * 60 * 1000).toISOString();

  const { error: eventoError } = await supabase.from("calendar_events").insert({
    titulo: tituloEvento,
    descricao: parsed.data.descricao ?? null,
    inicio: parsed.data.data_hora,
    fim: fimDataHora,
    sub_calendar: "agencia",
    criado_por: actor.id,
    participantes_ids: [actor.id],
    lead_id: lead.id,
    organization_id: lead.organization_id,
  });
  if (eventoError) return { error: eventoError.message };

  const updateField = parsed.data.tipo === "prospeccao_agendada"
    ? "data_prospeccao_agendada"
    : "data_reuniao_marco_zero";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = { [updateField]: parsed.data.data_hora };

  const { error: updateError } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", lead.id);
  if (updateError) return { error: updateError.message };

  await supabase.from("audit_log").insert({
    ator_id: actor.id,
    acao: "update",
    entidade: "leads",
    entidade_id: lead.id,
    dados_depois: { reuniao_agendada: parsed.data.tipo, data: parsed.data.data_hora },
  });

  revalidatePath(`/prospeccao/prospects/${lead.id}`);
  revalidatePath("/prospeccao/agenda");
  revalidatePath("/calendario");

  return { success: true };
}

export async function marcarPerdidoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = marcarPerdidoSchema.safeParse({
    lead_id: formData.get("lead_id"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("leads")
    .update({ motivo_perdido: parsed.data.motivo })
    .eq("id", parsed.data.lead_id);
  if (updateError) return { error: updateError.message };

  await supabase.from("audit_log").insert({
    ator_id: actor.id,
    acao: "soft_delete",
    entidade: "leads",
    entidade_id: parsed.data.lead_id,
    dados_depois: { marcado_perdido: true, motivo: parsed.data.motivo },
    justificativa: parsed.data.motivo,
  });

  revalidatePath(`/prospeccao/prospects/${parsed.data.lead_id}`);
  revalidatePath("/prospeccao/prospects");

  return { success: true };
}

export async function addLeadAttemptAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = addAttemptSchema.safeParse({
    lead_id: formData.get("lead_id"),
    canal: formData.get("canal"),
    resultado: formData.get("resultado"),
    observacao: formData.get("observacao"),
    proximo_passo: formData.get("proximo_passo"),
    data_proximo_passo: formData.get("data_proximo_passo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { error } = await supabase.from("lead_attempts").insert({
    lead_id: parsed.data.lead_id,
    autor_id: actor.id,
    canal: parsed.data.canal,
    resultado: parsed.data.resultado,
    observacao: parsed.data.observacao ?? null,
    proximo_passo: parsed.data.proximo_passo ?? null,
    data_proximo_passo: parsed.data.data_proximo_passo ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/prospeccao/prospects/${parsed.data.lead_id}`);

  return { success: true };
}
