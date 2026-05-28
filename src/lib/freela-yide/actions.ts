"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { transicaoValida } from "./pontos";
import type { StatusOp } from "./tipos";
import { criarOportunidadeSchema, moverStatusSchema, definirMetaSchema } from "./schema";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES_GESTAO = ["adm", "socio"] as const;
function isGestao(role: string): boolean { return (ROLES_GESTAO as readonly string[]).includes(role); }

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

async function orgIdDo(userId: string, sb: ReturnType<typeof createClient> extends Promise<infer C> ? C : never): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).from("profiles").select("organization_id").eq("id", userId).single();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

export async function criarOportunidadeAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const parsed = criarOportunidadeSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    cliente_nome: fd(formData, "cliente_nome"),
    contato: fd(formData, "contato"),
    valor_comissao: fd(formData, "valor_comissao") ?? 0,
    tipo: fd(formData, "tipo") ?? "captacao",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const orgId = await orgIdDo(actor.id, supabase);
  if (!orgId) return { error: "Organização não encontrada" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_oportunidades").insert({
    organization_id: orgId,
    criado_por: actor.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao,
    cliente_nome: parsed.data.cliente_nome,
    contato: parsed.data.contato,
    valor_comissao: parsed.data.valor_comissao,
    tipo: parsed.data.tipo,
    status: "disponivel",
  });
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function pegarOportunidadeAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: op } = await sb.from("freela_oportunidades").select("status, pego_por").eq("id", id).single();
  if (!op) return { error: "Oportunidade não encontrada" };
  if (op.status !== "disponivel") return { error: "Essa oportunidade já foi pega" };

  const { data: upd, error } = await sb.from("freela_oportunidades")
    .update({ status: "pega", pego_por: actor.id, pego_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "disponivel").select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Alguém pegou primeiro" }; // corrida (RLS update silencioso)
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function moverStatusAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const parsed = moverStatusSchema.safeParse({ id: fd(formData, "id"), status: fd(formData, "status") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const novo = parsed.data.status as StatusOp;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: op } = await sb.from("freela_oportunidades").select("status, pego_por").eq("id", parsed.data.id).single();
  if (!op) return { error: "Oportunidade não encontrada" };

  const ehDono = op.pego_por === actor.id;
  if (!ehDono && !isGestao(actor.role)) return { error: "Só quem pegou (ou adm/sócio) pode mover" };
  if (!transicaoValida(op.status as StatusOp, novo)) return { error: "Transição inválida" };

  const patch: Record<string, unknown> = { status: novo, updated_at: new Date().toISOString() };
  if (novo === "em_negociacao") patch.negociacao_em = new Date().toISOString();
  if (novo === "fechada") patch.fechada_em = new Date().toISOString();
  if (novo === "disponivel") { patch.pego_por = null; patch.pego_em = null; patch.negociacao_em = null; patch.fechada_em = null; }

  const { error } = await sb.from("freela_oportunidades").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function excluirOportunidadeAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_oportunidades")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}

export async function definirMetaAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!isGestao(actor.role)) return { error: "Sem permissão" };
  const parsed = definirMetaSchema.safeParse({
    descricao: fd(formData, "descricao"),
    tipo_alvo: fd(formData, "tipo_alvo"),
    alvo: fd(formData, "alvo") ?? 0,
    bonus_descricao: fd(formData, "bonus_descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const orgId = await orgIdDo(actor.id, supabase);
  if (!orgId) return { error: "Organização não encontrada" };
  const mes = new Date();
  const mesIso = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("freela_metas").upsert({
    organization_id: orgId, mes: mesIso, criado_por: actor.id,
    descricao: parsed.data.descricao, tipo_alvo: parsed.data.tipo_alvo,
    alvo: parsed.data.alvo, bonus_descricao: parsed.data.bonus_descricao,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,mes" });
  if (error) return { error: error.message };
  revalidatePath("/freela-yide");
  return { success: true };
}
