"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { FINANCEIRO_CACHE_TAG } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

async function requireSocio() {
  const actor = await requireAuth();
  if (actor.role !== "socio") {
    throw new Error("Apenas sócio pode acessar Financeiro");
  }
  return actor;
}

function revalidateCaixa() {
  revalidatePath("/financeiro/caixa");
  revalidateTag(FINANCEIRO_CACHE_TAG, "default");
}

const createAporteSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  valor: z.coerce.number().positive("Valor precisa ser maior que zero"),
  socio_id: z.string().uuid("Sócio inválido"),
  tipo: z.enum(["capital", "emprestimo"]),
  descricao: z.string().trim().max(1000).optional().nullable(),
});

const deleteAporteSchema = z.object({
  id: z.string().uuid(),
});

export async function createAporteAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = createAporteSchema.safeParse({
    data: fd(formData, "data"),
    valor: fd(formData, "valor") ?? 0,
    socio_id: fd(formData, "socio_id"),
    tipo: fd(formData, "tipo"),
    descricao: fd(formData, "descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    data: parsed.data.data,
    valor: parsed.data.valor,
    socio_id: parsed.data.socio_id,
    tipo: parsed.data.tipo,
    descricao: parsed.data.descricao ?? null,
    created_by: actor.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from("capital_aportes")
    .insert(insertPayload)
    .select("id");
  if (error) return { error: error.message };
  // RLS deny em INSERT devolve linhas vazias silenciosamente.
  if (!created || created.length === 0) {
    return { error: "Falha ao criar aporte (verifique permissões RLS)" };
  }

  await logAudit({
    entidade: "capital_aportes",
    entidade_id: created[0].id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateCaixa();
  return { success: true as const, id: created[0].id };
}

export async function deleteAporteAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = deleteAporteSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb
    .from("capital_aportes")
    .select("*")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Aporte não encontrado" };

  const { data: deleted, error } = await sb
    .from("capital_aportes")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: error.message };
  // RLS deny em DELETE é silencioso: checa retorno pra detectar bloqueio.
  if (!deleted || deleted.length === 0) {
    return { error: "Falha ao excluir (verifique permissões RLS)" };
  }

  await logAudit({
    entidade: "capital_aportes",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: before as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateCaixa();
  return { success: true as const };
}
