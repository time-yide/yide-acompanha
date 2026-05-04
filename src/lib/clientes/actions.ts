"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createClienteSchema, editClienteSchema, churnClienteSchema, inferTipoPacote, TIPOS_RELACAO } from "./schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    tipo_pacote: fd(formData, "tipo_pacote"),
    cadencia_reuniao: fd(formData, "cadencia_reuniao"),
    numero_unidades: fd(formData, "numero_unidades") ?? 1,
    valor_trafego_google: fd(formData, "valor_trafego_google"),
    valor_trafego_meta: fd(formData, "valor_trafego_meta"),
    tipo_pacote_revisado: fd(formData, "tipo_pacote_revisado"),
    tipo_relacao: fd(formData, "tipo_relacao") ?? "comum",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // If user explicitly chose tipo_pacote, respect it and mark as reviewed.
  // Otherwise infer from servico_contratado and leave revisado=false.
  const tipoPacoteExplicito = parsed.data.tipo_pacote ?? null;
  // Parceria/permuta: força valor_mensal = 0
  const tipoRelacao = parsed.data.tipo_relacao ?? "comum";
  const valorMensal = tipoRelacao !== "comum" ? 0 : parsed.data.valor_mensal;
  const insertPayload = {
    organization_id: org.id,
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: valorMensal,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || new Date().toISOString().slice(0, 10),
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
    tipo_pacote: tipoPacoteExplicito ?? inferTipoPacote(parsed.data.servico_contratado),
    tipo_pacote_revisado: tipoPacoteExplicito !== null ? true : false,
    cadencia_reuniao: parsed.data.cadencia_reuniao ?? null,
    numero_unidades: parsed.data.numero_unidades ?? 1,
    valor_trafego_google: parsed.data.valor_trafego_google ?? null,
    valor_trafego_meta: parsed.data.valor_trafego_meta ?? null,
    tipo_relacao: tipoRelacao,
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
  revalidateTag("dashboard", "default");
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
    designer_id: fd(formData, "designer_id"),
    videomaker_id: fd(formData, "videomaker_id"),
    editor_id: fd(formData, "editor_id"),
    instagram_url: fd(formData, "instagram_url") ?? "",
    gmn_url: fd(formData, "gmn_url") ?? "",
    drive_url: fd(formData, "drive_url") ?? "",
    pacote_post_padrao: fd(formData, "pacote_post_padrao"),
    tipo_pacote: fd(formData, "tipo_pacote"),
    cadencia_reuniao: fd(formData, "cadencia_reuniao"),
    numero_unidades: fd(formData, "numero_unidades") ?? 1,
    valor_trafego_google: fd(formData, "valor_trafego_google"),
    valor_trafego_meta: fd(formData, "valor_trafego_meta"),
    tipo_pacote_revisado: fd(formData, "tipo_pacote_revisado"),
    tipo_relacao: fd(formData, "tipo_relacao") ?? "comum",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!isPrivileged && (
    parsed.data.assessor_id !== before.assessor_id ||
    parsed.data.coordenador_id !== before.coordenador_id
  )) {
    return { error: "Apenas ADM/Sócio podem trocar assessor/coordenador" };
  }

  // tipo_pacote_revisado=true whenever the form is submitted (user reviewed fields).
  const tipoPacoteExplicitoEdit = parsed.data.tipo_pacote ?? null;
  // Parceria/permuta: força valor_mensal = 0
  const tipoRelacaoEdit = parsed.data.tipo_relacao ?? "comum";
  const valorMensalEdit = tipoRelacaoEdit !== "comum" ? 0 : parsed.data.valor_mensal;
  const updatePayload = {
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: valorMensalEdit,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || before.data_entrada,
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
    designer_id: parsed.data.designer_id || null,
    videomaker_id: parsed.data.videomaker_id || null,
    editor_id: parsed.data.editor_id || null,
    instagram_url: parsed.data.instagram_url || null,
    gmn_url: parsed.data.gmn_url || null,
    drive_url: parsed.data.drive_url || null,
    pacote_post_padrao: parsed.data.pacote_post_padrao ?? null,
    tipo_pacote: tipoPacoteExplicitoEdit ?? inferTipoPacote(parsed.data.servico_contratado),
    tipo_pacote_revisado: true,
    cadencia_reuniao: parsed.data.cadencia_reuniao ?? null,
    numero_unidades: parsed.data.numero_unidades ?? 1,
    valor_trafego_google: parsed.data.valor_trafego_google ?? null,
    valor_trafego_meta: parsed.data.valor_trafego_meta ?? null,
    tipo_relacao: tipoRelacaoEdit,
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
  revalidateTag("dashboard", "default");
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
  revalidateTag("dashboard", "default");
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
  revalidateTag("dashboard", "default");
  return { success: "Cliente reativado" };
}

const deleteClienteSchema = z.object({
  id: z.string().uuid(),
  // O usuário tem que digitar o nome exato do cliente como confirmação
  // (mesmo padrão do GitHub pra deletar repo).
  confirmacao_nome: z.string().min(1, "Digite o nome do cliente para confirmar"),
  justificativa: z.string().min(3, "Informe o motivo da exclusão (mín. 3 caracteres)"),
});

export async function deleteClienteAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem excluir clientes" };
  }

  const parsed = deleteClienteSchema.safeParse({
    id: fd(formData, "id"),
    confirmacao_nome: fd(formData, "confirmacao_nome"),
    justificativa: fd(formData, "justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (!cliente) return { error: "Cliente não encontrado" };

  // Confirmação de nome (case-insensitive, trim)
  if (
    parsed.data.confirmacao_nome.trim().toLowerCase() !==
    cliente.nome.trim().toLowerCase()
  ) {
    return { error: "Nome digitado não confere com o nome do cliente" };
  }

  // Loga ANTES de deletar (depois o id some). Audit log preserva tudo.
  await logAudit({
    entidade: "clients",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: cliente as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  // Hard delete — FKs em outras tabelas usam ON DELETE CASCADE
  // (client_monthly_checklist, satisfaction_entries, client_files, etc.)
  // ou ON DELETE SET NULL (tasks.client_id, calendar_events.client_id, leads.client_id).
  // .select() retorna as linhas deletadas — se vier vazio, RLS bloqueou
  // silenciosamente (não dá erro mas zero rows afetadas).
  const { data: deleted, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Falha ao excluir: cliente não foi removido (verifique permissões)" };
  }

  revalidatePath("/clientes");
  revalidateTag("dashboard", "default");
  redirect("/clientes");
}

type AssignmentField = "assessor_id" | "coordenador_id";

const FIELD_TO_ROLE: Record<AssignmentField, "assessor" | "coordenador"> = {
  assessor_id: "assessor",
  coordenador_id: "coordenador",
};

async function validateProfileRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  expectedRole: "assessor" | "coordenador",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !data) return { ok: false, error: "Papel inválido para essa atribuição" };
  if (data.role !== expectedRole) {
    return { ok: false, error: "Papel inválido para essa atribuição" };
  }
  return { ok: true };
}

export async function updateClienteAssignmentAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const clienteIdRaw = formData.get("cliente_id");
  const clienteId = typeof clienteIdRaw === "string" ? clienteIdRaw.trim() : "";
  if (!clienteId || !UUID_RE.test(clienteId)) {
    return { error: "ID do cliente inválido" };
  }

  const hasAssessor = formData.has("assessor_id");
  const hasCoordenador = formData.has("coordenador_id");
  if (!hasAssessor && !hasCoordenador) {
    return { error: "Nada para atualizar" };
  }

  // Parse cada field presente: "" -> null (unassign), uuid -> set, must be UUID.
  const proposed: Partial<Record<AssignmentField, string | null>> = {};
  for (const field of ["assessor_id", "coordenador_id"] as const) {
    if (!formData.has(field)) continue;
    const raw = formData.get(field);
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v === "") {
      proposed[field] = null;
    } else if (!UUID_RE.test(v)) {
      return { error: "ID inválido" };
    } else {
      proposed[field] = v;
    }
  }

  const supabase = await createClient();

  // Valida role antes de tocar no cliente — barra atribuição cruzada.
  for (const [field, value] of Object.entries(proposed) as Array<
    [AssignmentField, string | null]
  >) {
    if (value === null) continue;
    const check = await validateProfileRole(supabase, value, FIELD_TO_ROLE[field]);
    if (!check.ok) return { error: check.error };
  }

  const { data: before, error: beforeErr } = await supabase
    .from("clients")
    .select("id, assessor_id, coordenador_id")
    .eq("id", clienteId)
    .single();
  if (beforeErr || !before) return { error: "Cliente não encontrado" };

  // Idempotência: monta patch só com fields que de fato mudam.
  const patch: Partial<Record<AssignmentField, string | null>> = {};
  const dadosAntes: Record<string, unknown> = {};
  const dadosDepois: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(proposed) as Array<
    [AssignmentField, string | null]
  >) {
    const beforeValue = (before as Record<string, unknown>)[field] ?? null;
    if (beforeValue !== value) {
      patch[field] = value;
      dadosAntes[field] = beforeValue;
      dadosDepois[field] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { success: true };
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", clienteId);
  if (updErr) return { error: updErr.message };

  await logAudit({
    entidade: "clients",
    entidade_id: clienteId,
    acao: "update",
    dados_antes: dadosAntes,
    dados_depois: dadosDepois,
    ator_id: actor.id,
    justificativa: "Atribuição alterada via listagem",
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidateTag("dashboard", "default");
  return { success: true };
}

export async function bulkAssignClientesAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const idsRaw = formData.get("cliente_ids");
  let parsedIds: unknown;
  try {
    parsedIds = typeof idsRaw === "string" ? JSON.parse(idsRaw) : null;
  } catch {
    return { error: "Selecione ao menos um cliente" };
  }
  if (!Array.isArray(parsedIds) || parsedIds.length === 0) {
    return { error: "Selecione ao menos um cliente" };
  }
  if (parsedIds.length > 500) {
    return { error: "Limite de 500 clientes por operação" };
  }
  for (const id of parsedIds) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return { error: "ID do cliente inválido" };
    }
  }
  const clienteIds = parsedIds as string[];

  const hasAssessor = formData.has("assessor_id");
  const hasCoordenador = formData.has("coordenador_id");
  if (!hasAssessor && !hasCoordenador) {
    return { error: "Selecione assessor ou coordenador para atribuir" };
  }

  const proposed: Partial<Record<AssignmentField, string | null>> = {};
  for (const field of ["assessor_id", "coordenador_id"] as const) {
    if (!formData.has(field)) continue;
    const raw = formData.get(field);
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v === "") {
      proposed[field] = null;
    } else if (!UUID_RE.test(v)) {
      return { error: "ID inválido" };
    } else {
      proposed[field] = v;
    }
  }

  const supabase = await createClient();

  for (const [field, value] of Object.entries(proposed) as Array<
    [AssignmentField, string | null]
  >) {
    if (value === null) continue;
    const check = await validateProfileRole(supabase, value, FIELD_TO_ROLE[field]);
    if (!check.ok) return { error: check.error };
  }

  const patch: Partial<Record<AssignmentField, string | null>> = { ...proposed };

  const { error: updErr } = await supabase
    .from("clients")
    .update(patch)
    .in("id", clienteIds);
  if (updErr) return { error: updErr.message };

  for (const id of clienteIds) {
    await logAudit({
      entidade: "clients",
      entidade_id: id,
      acao: "update",
      dados_depois: patch as Record<string, unknown>,
      ator_id: actor.id,
      justificativa: "Atribuição em massa via listagem",
    });
  }

  revalidatePath("/clientes");
  revalidateTag("dashboard", "default");
  return { success: true, count: clienteIds.length };
}

// ─── Ajustes mensais ──────────────────────────────────────────────────────────

const ajusteMensalSchema = z.object({
  client_id: z.string().uuid(),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/),
  tipo: z.enum(["desconto_parcial", "gratuidade_total"]),
  valor_desconto: z.coerce.number().min(0).optional().nullable(),
  motivo: z.string().min(3, "Informe o motivo (mín. 3 caracteres)"),
});

export async function setAjusteMensalAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem lançar ajustes" };
  }

  const parsed = ajusteMensalSchema.safeParse({
    client_id: fd(formData, "client_id"),
    mes_referencia: fd(formData, "mes_referencia"),
    tipo: fd(formData, "tipo"),
    valor_desconto: fd(formData, "valor_desconto") ?? null,
    motivo: fd(formData, "motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Validação extra: desconto_parcial precisa de valor
  if (parsed.data.tipo === "desconto_parcial" && (!parsed.data.valor_desconto || parsed.data.valor_desconto <= 0)) {
    return { error: "Desconto parcial precisa de um valor maior que zero" };
  }
  if (parsed.data.tipo === "gratuidade_total" && parsed.data.valor_desconto) {
    return { error: "Gratuidade total não usa valor de desconto" };
  }

  const supabase = await createClient();
  const payload = {
    client_id: parsed.data.client_id,
    mes_referencia: parsed.data.mes_referencia,
    tipo: parsed.data.tipo,
    valor_desconto: parsed.data.tipo === "desconto_parcial" ? parsed.data.valor_desconto : null,
    motivo: parsed.data.motivo.trim(),
    criado_por: actor.id,
  };

  // Upsert: se já tem ajuste pra esse mês, sobrescreve
  const { error } = await supabase
    .from("client_monthly_adjustments")
    .upsert(payload, { onConflict: "client_id,mes_referencia" });
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_monthly_adjustments",
    entidade_id: parsed.data.client_id,
    acao: "create",
    dados_depois: payload as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.motivo,
  });

  revalidatePath(`/clientes/${parsed.data.client_id}`);
  revalidatePath("/clientes");
  revalidateTag("dashboard", "default");
  return { success: true };
}

export async function removeAjusteMensalAction(clientId: string, mesReferencia: string) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem remover ajustes" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_adjustments")
    .delete()
    .eq("client_id", clientId)
    .eq("mes_referencia", mesReferencia);
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  revalidateTag("dashboard", "default");
  return { success: true };
}
