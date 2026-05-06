"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  createExpenseSchema,
  updateExpenseSchema,
  overrideSchema,
  bulkDeleteExpensesSchema,
  FINANCEIRO_CACHE_TAG,
} from "./schema";
import { parseBulkExpenses } from "./import";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function revalidateAll(expenseId?: string) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/despesas");
  if (expenseId) revalidatePath(`/financeiro/despesas/${expenseId}`);
  revalidateTag(FINANCEIRO_CACHE_TAG, "default");
}

export async function createExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = createExpenseSchema.safeParse({
    descricao: fd(formData, "descricao"),
    categoria: fd(formData, "categoria"),
    tipo: fd(formData, "tipo"),
    valor: fd(formData, "valor") ?? 0,
    mes_referencia: fd(formData, "mes_referencia"),
    inicio_mes: fd(formData, "inicio_mes"),
    fim_mes: fd(formData, "fim_mes"),
    notas: fd(formData, "notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    descricao: parsed.data.descricao,
    categoria: parsed.data.categoria,
    tipo: parsed.data.tipo,
    valor: parsed.data.valor,
    mes_referencia: parsed.data.mes_referencia ?? null,
    inicio_mes: parsed.data.inicio_mes ?? null,
    fim_mes: parsed.data.fim_mes ?? null,
    notas: parsed.data.notas ?? null,
    criado_por: actor.id,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from("expenses")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar despesa" };

  await logAudit({
    entidade: "expenses",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateAll();
  return { success: true as const, id: created.id };
}

export async function updateExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = updateExpenseSchema.safeParse({
    id: fd(formData, "id"),
    descricao: fd(formData, "descricao"),
    categoria: fd(formData, "categoria"),
    tipo: fd(formData, "tipo"),
    valor: fd(formData, "valor") ?? 0,
    mes_referencia: fd(formData, "mes_referencia"),
    inicio_mes: fd(formData, "inicio_mes"),
    fim_mes: fd(formData, "fim_mes"),
    notas: fd(formData, "notas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb.from("expenses").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Despesa não encontrada" };

  const updatePayload = {
    descricao: parsed.data.descricao,
    categoria: parsed.data.categoria,
    tipo: parsed.data.tipo,
    valor: parsed.data.valor,
    mes_referencia: parsed.data.mes_referencia ?? null,
    inicio_mes: parsed.data.inicio_mes ?? null,
    fim_mes: parsed.data.fim_mes ?? null,
    notas: parsed.data.notas ?? null,
  };

  const { error } = await sb.from("expenses").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateAll(parsed.data.id);
  return { success: true as const };
}

export async function deactivateExpenseAction(id: string) {
  const actor = await requireSocio();
  if (!UUID_RE.test(id)) return { error: "ID inválido" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb.from("expenses").select("*").eq("id", id).single();
  if (!before) return { error: "Despesa não encontrada" };
  if ((before as { tipo: string }).tipo !== "fixa") {
    return { error: "Desativação só faz sentido pra despesa fixa" };
  }

  const now = new Date();
  const proxMes = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const fim_mes = `${proxMes.getFullYear()}-${String(proxMes.getMonth() + 1).padStart(2, "0")}`;

  const { error } = await sb.from("expenses").update({ fim_mes }).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: id,
    acao: "update",
    dados_antes: { fim_mes: (before as { fim_mes: string | null }).fim_mes },
    dados_depois: { fim_mes },
    ator_id: actor.id,
    justificativa: "Desativação via /financeiro/despesas",
  });

  revalidateAll(id);
  return { success: true as const };
}

const deleteSchema = z.object({
  id: z.string().uuid(),
  justificativa: z.string().min(3, "Informe o motivo (mín. 3 caracteres)"),
});

export async function deleteExpenseAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = deleteSchema.safeParse({
    id: fd(formData, "id"),
    justificativa: fd(formData, "justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: before } = await sb.from("expenses").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Despesa não encontrada" };

  await logAudit({
    entidade: "expenses",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: before as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  const { data: deleted, error } = await sb
    .from("expenses")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Falha ao excluir (verifique permissões RLS)" };
  }

  revalidateAll();
  return { success: true as const };
}

export async function bulkDeleteExpensesAction(formData: FormData) {
  const actor = await requireSocio();

  const idsRaw = fd(formData, "ids");
  const ids = idsRaw ? idsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const parsed = bulkDeleteExpensesSchema.safeParse({
    ids,
    justificativa: fd(formData, "justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: beforeRows } = await sb
    .from("expenses")
    .select("*")
    .in("id", parsed.data.ids);
  const beforeList = (beforeRows ?? []) as Array<Record<string, unknown> & { id: string }>;
  if (beforeList.length === 0) return { error: "Nenhuma despesa encontrada" };

  await Promise.all(
    beforeList.map((row) =>
      logAudit({
        entidade: "expenses",
        entidade_id: row.id,
        acao: "delete",
        dados_antes: row,
        ator_id: actor.id,
        justificativa: parsed.data.justificativa,
      }),
    ),
  );

  const { data: deleted, error } = await sb
    .from("expenses")
    .delete()
    .in("id", parsed.data.ids)
    .select("id");
  if (error) return { error: error.message };
  const deletedCount = (deleted ?? []).length;
  if (deletedCount === 0) {
    return { error: "Falha ao excluir (verifique permissões RLS)" };
  }

  revalidateAll();
  return { success: true as const, deletedCount };
}

export async function setOverrideAction(formData: FormData) {
  const actor = await requireSocio();

  const parsed = overrideSchema.safeParse({
    expense_id: fd(formData, "expense_id"),
    mes_referencia: fd(formData, "mes_referencia"),
    valor: fd(formData, "valor") ?? 0,
    motivo: fd(formData, "motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: expense } = await sb
    .from("expenses")
    .select("tipo")
    .eq("id", parsed.data.expense_id)
    .single();
  if (!expense) return { error: "Despesa não encontrada" };
  if ((expense as { tipo: string }).tipo !== "fixa") {
    return { error: "Override só faz sentido pra despesa fixa" };
  }

  const upsertPayload = {
    expense_id: parsed.data.expense_id,
    mes_referencia: parsed.data.mes_referencia,
    valor: parsed.data.valor,
    motivo: parsed.data.motivo ?? null,
    criado_por: actor.id,
  };

  const { error } = await sb
    .from("expense_overrides")
    .upsert(upsertPayload, { onConflict: "expense_id,mes_referencia" });
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expense_overrides",
    entidade_id: parsed.data.expense_id,
    acao: "update",
    dados_depois: upsertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: parsed.data.motivo ?? undefined,
  });

  revalidateAll(parsed.data.expense_id);
  return { success: true as const };
}

export async function removeOverrideAction(expenseId: string, mesRef: string) {
  const actor = await requireSocio();
  if (!UUID_RE.test(expenseId)) return { error: "ID inválido" };
  if (!/^\d{4}-\d{2}$/.test(mesRef)) return { error: "Mês inválido" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("expense_overrides")
    .delete()
    .eq("expense_id", expenseId)
    .eq("mes_referencia", mesRef);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expense_overrides",
    entidade_id: expenseId,
    acao: "delete",
    dados_antes: { mes_referencia: mesRef },
    ator_id: actor.id,
  });

  revalidateAll(expenseId);
  return { success: true as const };
}

export async function bulkImportExpensesAction(formData: FormData) {
  const actor = await requireSocio();

  const text = String(formData.get("import_text") ?? "");
  if (!text.trim()) return { error: "Cole os dados antes de importar" };

  const parsed = parseBulkExpenses(text);
  if (parsed.rows.length === 0) {
    return { error: `Nenhuma linha válida (${parsed.errors.length} erro(s))` };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const payload = parsed.rows.map((r) => ({
    organization_id: org.id,
    descricao: r.descricao,
    categoria: r.categoria,
    tipo: r.tipo,
    valor: r.valor,
    mes_referencia: r.mes_referencia,
    inicio_mes: r.inicio_mes,
    fim_mes: r.fim_mes,
    notas: r.notas,
    criado_por: actor.id,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: inserted, error } = await sb
    .from("expenses")
    .insert(payload)
    .select("id");
  if (error) return { error: error.message };

  await logAudit({
    entidade: "expenses",
    entidade_id: "bulk-import",
    acao: "create",
    dados_depois: { count: inserted?.length ?? 0, errors: parsed.errors.length } as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: `Bulk import de ${inserted?.length ?? 0} despesa(s)`,
  });

  revalidateAll();
  return { success: true as const, count: inserted?.length ?? 0, errors: parsed.errors.length };
}
