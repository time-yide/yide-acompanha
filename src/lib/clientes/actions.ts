"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createClienteSchema, editClienteSchema, churnClienteSchema, inferTipoPacote } from "./schema";

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
    tipo_pacote: inferTipoPacote(parsed.data.servico_contratado),
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
    designer_id: fd(formData, "designer_id"),
    videomaker_id: fd(formData, "videomaker_id"),
    editor_id: fd(formData, "editor_id"),
    instagram_url: fd(formData, "instagram_url") ?? "",
    gmn_url: fd(formData, "gmn_url") ?? "",
    drive_url: fd(formData, "drive_url") ?? "",
    pacote_post_padrao: fd(formData, "pacote_post_padrao"),
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
    designer_id: parsed.data.designer_id || null,
    videomaker_id: parsed.data.videomaker_id || null,
    editor_id: parsed.data.editor_id || null,
    instagram_url: parsed.data.instagram_url || null,
    gmn_url: parsed.data.gmn_url || null,
    drive_url: parsed.data.drive_url || null,
    pacote_post_padrao: parsed.data.pacote_post_padrao ?? null,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return { success: true, count: clienteIds.length };
}
