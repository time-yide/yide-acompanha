"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "./access";
import { veTudo } from "./queries";
import {
  criarLancamentoSchema,
  updateLancamentoSchema,
  arquivarLancamentoSchema,
} from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

function fd(f: FormData, k: string): string | null {
  const v = f.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function criarLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = criarLancamentoSchema.safeParse({
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    tipo: fd(formData, "tipo"),
    quantidade: fd(formData, "quantidade"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: cli } = await sb
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cli) return { error: "Cliente não encontrado" };

  const { error } = await sb.from("lancamentos_programacao").insert({
    organization_id: orgId,
    client_id: parsed.data.client_id,
    colaborador_id: actor.id,
    data: parsed.data.data,
    tipo: parsed.data.tipo,
    quantidade: parsed.data.quantidade,
    observacao: parsed.data.observacao,
  });
  if (error) return { error: error.message };
  revalidatePath("/programacao");
  return { success: true };
}

export async function updateLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = updateLancamentoSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    data: fd(formData, "data"),
    tipo: fd(formData, "tipo"),
    quantidade: fd(formData, "quantidade"),
    observacao: fd(formData, "observacao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .update({
      client_id: parsed.data.client_id,
      data: parsed.data.data,
      tipo: parsed.data.tipo,
      quantidade: parsed.data.quantidade,
      observacao: parsed.data.observacao,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para atualizar" };
  revalidatePath("/programacao");
  return { success: true };
}

export async function arquivarLancamentoAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canAccessProgramacao(actor.role)) return { error: "Sem permissão" };
  const parsed = arquivarLancamentoSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("lancamentos_programacao")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", orgId);
  if (!veTudo(actor.role)) q = q.eq("colaborador_id", actor.id);
  const { data, error } = await q.select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Nada para arquivar" };
  revalidatePath("/programacao");
  return { success: true };
}
