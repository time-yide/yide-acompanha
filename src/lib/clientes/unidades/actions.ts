"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { createUnidadeSchema, updateUnidadeSchema } from "./schema";

type ActionResult = { success?: boolean; error?: string };

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor"];

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

export async function createUnidadeAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão pra criar unidade" };
  }

  const parsed = createUnidadeSchema.safeParse({
    client_id: fd(formData, "client_id"),
    nome: fd(formData, "nome"),
    endereco: fd(formData, "endereco"),
    drive_url: fd(formData, "drive_url") ?? "",
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const insertPayload = {
    client_id: parsed.data.client_id,
    nome: parsed.data.nome,
    endereco: parsed.data.endereco ?? null,
    drive_url: parsed.data.drive_url || null,
    observacoes: parsed.data.observacoes ?? null,
  };
  const { data: created, error } = await sb
    .from("client_units")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao cadastrar unidade" };

  await logAudit({
    entidade: "client_units",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${parsed.data.client_id}/unidades`);
  return { success: true };
}

export async function updateUnidadeAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão pra editar unidade" };
  }

  const parsed = updateUnidadeSchema.safeParse({
    id: fd(formData, "id"),
    nome: fd(formData, "nome"),
    endereco: fd(formData, "endereco"),
    drive_url: fd(formData, "drive_url") ?? "",
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const updatePayload = {
    nome: parsed.data.nome,
    endereco: parsed.data.endereco ?? null,
    drive_url: parsed.data.drive_url || null,
    observacoes: parsed.data.observacoes ?? null,
  };
  const { data: existing } = await sb
    .from("client_units")
    .select("client_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await sb
    .from("client_units")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_units",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (existing?.client_id) revalidatePath(`/clientes/${existing.client_id}/unidades`);
  return { success: true };
}

export async function toggleUnidadeAtivoAction(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb
    .from("client_units")
    .select("client_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb
    .from("client_units")
    .update({ ativo })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_units",
    entidade_id: id,
    acao: "update",
    dados_depois: { ativo },
    ator_id: actor.id,
  });

  if (existing?.client_id) revalidatePath(`/clientes/${existing.client_id}/unidades`);
  return { success: true };
}

export async function deleteUnidadeAction(id: string): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb
    .from("client_units")
    .select("client_id, nome")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb.from("client_units").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_units",
    entidade_id: id,
    acao: "delete",
    dados_antes: existing as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  if (existing?.client_id) revalidatePath(`/clientes/${existing.client_id}/unidades`);
  return { success: true };
}
