"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";

type ActionResult = { error?: string; success?: boolean };

const ROLES_PODEM_RESTAURAR = ["adm", "socio", "coordenador", "assessor"];

function canRestore(role: string): boolean {
  return ROLES_PODEM_RESTAURAR.includes(role);
}

type Entidade = "cliente" | "lead" | "tarefa";

const ENTIDADE_TO_TABLE: Record<Entidade, string> = {
  cliente: "clients",
  lead: "leads",
  tarefa: "tasks",
};

const ENTIDADE_TO_AUDIT: Record<Entidade, string> = {
  cliente: "clients",
  lead: "leads",
  tarefa: "tasks",
};

const ENTIDADE_TO_TAGS: Record<Entidade, string[]> = {
  cliente: ["clients", "dashboard"],
  lead: ["prospects", "dashboard"],
  tarefa: ["tasks", "dashboard"],
};

const ENTIDADE_TO_PATHS: Record<Entidade, string[]> = {
  cliente: ["/clientes", "/painel"],
  lead: ["/onboarding", "/prospeccao"],
  tarefa: ["/tarefas"],
};

export async function restoreItemAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canRestore(actor.role)) {
    return { error: "Apenas adm, sócio, coordenador ou assessor podem restaurar itens" };
  }

  const id = String(formData.get("id") ?? "");
  const entidade = String(formData.get("entidade") ?? "") as Entidade;
  if (!id || !ENTIDADE_TO_TABLE[entidade]) {
    return { error: "Parâmetros inválidos" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: restored, error } = await sb
    .from(ENTIDADE_TO_TABLE[entidade])
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { error: error.message };
  if (!restored || restored.length === 0) {
    return { error: "Item não encontrado ou já restaurado" };
  }

  await logAudit({
    entidade: ENTIDADE_TO_AUDIT[entidade],
    entidade_id: id,
    acao: "update",
    dados_antes: { deleted_at: "set" } as Record<string, unknown>,
    dados_depois: { deleted_at: null, restored_by: actor.id } as Record<string, unknown>,
    ator_id: actor.id,
    justificativa: "Restaurado da lixeira",
  });

  for (const tag of ENTIDADE_TO_TAGS[entidade]) revalidateTag(tag, "default");
  for (const path of ENTIDADE_TO_PATHS[entidade]) revalidatePath(path);
  revalidatePath("/lixeira");

  return { success: true };
}
