"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createClienteSchema, editClienteSchema, churnClienteSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

export async function createClienteAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM e Sócio podem criar clientes" };
  }

  const parsed = createClienteSchema.safeParse({
    nome: fd(formData, "nome"),
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_mensal: fd(formData, "valor_mensal") ?? 0,
    servico_contratado: fd(formData, "servico_contratado"),
    data_entrada: fd(formData, "data_entrada"),
    assessor_id: fd(formData, "assessor_id"),
    coordenador_id: fd(formData, "coordenador_id"),
    data_aniversario_socio_cliente: fd(formData, "data_aniversario_socio_cliente"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: parsed.data.valor_mensal,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || new Date().toISOString().slice(0, 10),
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
  };

  const { data: created, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar cliente" };

  await logAudit({
    entidade: "clients",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload,
    ator_id: actor.id,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${created.id}`);
}

export async function updateClienteAction(formData: FormData) {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!before) return { error: "Cliente não encontrado" };

  const isPrivileged = ["adm", "socio"].includes(actor.role);
  const isOwner =
    actor.id === before.assessor_id || actor.id === before.coordenador_id;
  if (!isPrivileged && !isOwner) return { error: "Sem permissão" };

  const parsed = editClienteSchema.safeParse({
    id,
    nome: fd(formData, "nome"),
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_mensal: fd(formData, "valor_mensal") ?? 0,
    servico_contratado: fd(formData, "servico_contratado"),
    data_entrada: fd(formData, "data_entrada"),
    assessor_id: fd(formData, "assessor_id"),
    coordenador_id: fd(formData, "coordenador_id"),
    data_aniversario_socio_cliente: fd(formData, "data_aniversario_socio_cliente"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!isPrivileged && (
    parsed.data.assessor_id !== before.assessor_id ||
    parsed.data.coordenador_id !== before.coordenador_id
  )) {
    return { error: "Apenas ADM/Sócio podem trocar assessor/coordenador" };
  }

  const updatePayload = {
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: parsed.data.valor_mensal,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || before.data_entrada,
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
  };

  const { error } = await supabase.from("clients").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function churnClienteAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem dar churn" };
  }

  const parsed = churnClienteSchema.safeParse({
    id: fd(formData, "id"),
    motivo_churn: fd(formData, "motivo_churn"),
    data_churn: fd(formData, "data_churn"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const updatePayload = {
    status: "churn" as const,
    motivo_churn: parsed.data.motivo_churn,
    data_churn: parsed.data.data_churn || new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabase.from("clients").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: parsed.data.id,
    acao: "soft_delete",
    dados_depois: updatePayload,
    ator_id: actor.id,
    justificativa: parsed.data.motivo_churn,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${parsed.data.id}`);
}

export async function reactivateClienteAction(id: string) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem reativar" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "ativo", motivo_churn: null, data_churn: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: id,
    acao: "update",
    dados_depois: { status: "ativo" },
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${id}`);
  return { success: "Cliente reativado" };
}
