"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, type CurrentUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { logAudit } from "@/lib/audit/log";
import {
  erroAoFechar,
  podeConduzirCheck,
  segundaDaSemana,
  type CheckResultado,
  type CheckStatus,
} from "./core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res = { error?: string; ok?: boolean };

interface CheckRow {
  id: string;
  assessor_id: string;
  semana_inicio: string;
  status: CheckStatus;
}

function revalidar() {
  revalidatePath("/check", "layout");
}

async function carregarCheck(sb: SB, checkId: string): Promise<CheckRow | null> {
  const { data } = await sb
    .from("check_semanais")
    .select("id, assessor_id, semana_inicio, status")
    .eq("id", checkId)
    .maybeSingle();
  return data ?? null;
}

async function carregarItemComCheck(sb: SB, itemId: string): Promise<{ item: { id: string; check_id: string }; check: CheckRow } | null> {
  const { data: item } = await sb.from("check_itens").select("id, check_id").eq("id", itemId).maybeSingle();
  if (!item) return null;
  const check = await carregarCheck(sb, item.check_id);
  return check ? { item, check } : null;
}

function exigeConduzir(user: CurrentUser): Res | null {
  return podeConduzirCheck(user.role) ? null : { error: "Só sócio/adm conduzem o check" };
}

/** Cria o check da semana e traz os não feitos do último check fechado. */
export async function iniciarCheckAction(assessorId: string, semanaParam: string): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const semana = segundaDaSemana(semanaParam);
  const sb = createServiceRoleClient() as SB;

  const { data: assessor } = await sb.from("profiles").select("id, role").eq("id", assessorId).maybeSingle();
  if (!assessor) return { error: "Assessor não encontrado" };

  const { data: criado, error } = await sb
    .from("check_semanais")
    .insert({ assessor_id: assessorId, semana_inicio: semana, criado_por: user.id })
    .select("id")
    .single();
  if (error || !criado) {
    if (String(error?.message ?? "").includes("duplicate")) { revalidar(); return { ok: true }; }
    return { error: error?.message ?? "Falha ao criar o check" };
  }

  const { data: anterior } = await sb
    .from("check_semanais")
    .select("id")
    .eq("assessor_id", assessorId)
    .eq("status", "fechado")
    .lt("semana_inicio", semana)
    .order("semana_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anterior) {
    const { data: naoFeitos } = await sb
      .from("check_itens")
      .select("id, texto, cliente_id")
      .eq("check_id", anterior.id)
      .eq("resultado", "nao_feito")
      .order("ordem");
    const lista = (naoFeitos ?? []) as Array<{ id: string; texto: string; cliente_id: string | null }>;
    if (lista.length > 0) {
      await sb.from("check_itens").insert(
        lista.map((i, idx) => ({
          check_id: criado.id,
          texto: i.texto,
          cliente_id: i.cliente_id,
          origem: "semana_anterior",
          item_origem_id: i.id,
          ordem: idx,
        })),
      );
    }
  }

  revalidar();
  return { ok: true };
}

export async function adicionarItemAction(checkId: string, texto: string, clienteId: string | null): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const t = texto.trim();
  if (!t) return { error: "Escreva o item" };
  const sb = createServiceRoleClient() as SB;
  const check = await carregarCheck(sb, checkId);
  if (!check) return { error: "Check não encontrado" };
  if (check.status === "fechado") return { error: "Semana já fechada" };

  const { count } = await sb.from("check_itens").select("id", { count: "exact", head: true }).eq("check_id", checkId);
  const { error } = await sb.from("check_itens").insert({
    check_id: checkId,
    texto: t.slice(0, 500),
    cliente_id: clienteId || null,
    origem: "manual",
    ordem: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidar();
  return { ok: true };
}

export async function editarItemAction(itemId: string, texto: string, clienteId: string | null): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const t = texto.trim();
  if (!t) return { error: "O item não pode ficar vazio" };
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarItemComCheck(sb, itemId);
  if (!ctx) return { error: "Item não encontrado" };
  if (ctx.check.status === "fechado") return { error: "Semana já fechada" };
  const { error } = await sb
    .from("check_itens")
    .update({ texto: t.slice(0, 500), cliente_id: clienteId || null, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidar();
  return { ok: true };
}

export async function removerItemAction(itemId: string): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarItemComCheck(sb, itemId);
  if (!ctx) return { error: "Item não encontrado" };
  if (ctx.check.status === "fechado") return { error: "Semana já fechada" };
  const { error } = await sb.from("check_itens").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidar();
  return { ok: true };
}

export async function liberarCheckAction(checkId: string): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const sb = createServiceRoleClient() as SB;
  const check = await carregarCheck(sb, checkId);
  if (!check) return { error: "Check não encontrado" };
  if (check.status === "liberado" || check.status === "fechado") return { error: "Já foi liberado" };

  const { count } = await sb.from("check_itens").select("id", { count: "exact", head: true }).eq("check_id", checkId);
  if (!count) return { error: "Inclua pelo menos 1 item antes de liberar" };

  const { data: upd, error } = await sb
    .from("check_semanais")
    .update({ status: "liberado", liberado_em: new Date().toISOString(), liberado_por: user.id, updated_at: new Date().toISOString() })
    .eq("id", checkId)
    .neq("status", "fechado")
    .select("id");
  if (error || !upd?.length) return { error: error?.message ?? "Falha ao liberar" };

  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Seu check-in da semana está liberado",
      mensagem: `${user.nome} liberou ${count} item(ns) pra fazer até quinta.`,
      link: `/check/${check.assessor_id}?semana=${check.semana_inicio}`,
      user_ids_extras: [check.assessor_id],
      source_user_id: user.id,
    });
  } catch (e) {
    console.error("[check] notificação de liberação falhou:", e);
  }
  await logAudit({
    entidade: "check_semanais",
    entidade_id: checkId,
    acao: "update",
    dados_depois: { acao: "liberar", itens: count } as Record<string, unknown>,
    ator_id: user.id,
  });
  revalidar();
  return { ok: true };
}

/** Assessor (dono) marca/desmarca feito durante a semana. Gestão também pode. */
export async function marcarFeitoAction(itemId: string, feito: boolean): Promise<Res> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarItemComCheck(sb, itemId);
  if (!ctx) return { error: "Item não encontrado" };
  const dono = ctx.check.assessor_id === user.id;
  if (!dono && !podeConduzirCheck(user.role)) return { error: "Sem permissão" };
  if (ctx.check.status !== "liberado") return { error: "O check não está em andamento" };
  const { error } = await sb
    .from("check_itens")
    .update({ feito_assessor_em: feito ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidar();
  return { ok: true };
}

/** Check-out: Feito / Não feito (+ motivo). resultado null limpa. */
export async function definirResultadoAction(itemId: string, resultado: CheckResultado | null, motivo: string | null): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const sb = createServiceRoleClient() as SB;
  const ctx = await carregarItemComCheck(sb, itemId);
  if (!ctx) return { error: "Item não encontrado" };
  if (ctx.check.status !== "liberado") return { error: "Só dá pra conferir um check liberado e ainda aberto" };
  const { error } = await sb
    .from("check_itens")
    .update({
      resultado,
      motivo: resultado === "nao_feito" ? (motivo?.trim().slice(0, 1000) || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidar();
  return { ok: true };
}

export async function fecharSemanaAction(checkId: string): Promise<Res> {
  const user = await requireAuth();
  const negado = exigeConduzir(user);
  if (negado) return negado;
  const sb = createServiceRoleClient() as SB;
  const check = await carregarCheck(sb, checkId);
  if (!check) return { error: "Check não encontrado" };
  if (check.status !== "liberado") return { error: "Libere o check-in antes de fechar a semana" };

  const { data: itens } = await sb.from("check_itens").select("resultado, motivo").eq("check_id", checkId);
  const erro = erroAoFechar((itens ?? []) as Array<{ resultado: CheckResultado | null; motivo: string | null }>);
  if (erro) return { error: erro };

  const { data: upd, error } = await sb
    .from("check_semanais")
    .update({ status: "fechado", fechado_em: new Date().toISOString(), fechado_por: user.id, updated_at: new Date().toISOString() })
    .eq("id", checkId)
    .eq("status", "liberado")
    .select("id");
  if (error || !upd?.length) return { error: error?.message ?? "Falha ao fechar" };

  const lista = (itens ?? []) as Array<{ resultado: string | null }>;
  const feitos = lista.filter((i) => i.resultado === "feito").length;
  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Check-out da semana fechado",
      mensagem: `${feitos} de ${lista.length} item(ns) feitos. Os não feitos vão pro check-in de segunda.`,
      link: `/check/${check.assessor_id}?semana=${check.semana_inicio}`,
      user_ids_extras: [check.assessor_id],
      source_user_id: user.id,
    });
  } catch (e) {
    console.error("[check] notificação de fechamento falhou:", e);
  }
  await logAudit({
    entidade: "check_semanais",
    entidade_id: checkId,
    acao: "update",
    dados_depois: { acao: "fechar", feitos, total: lista.length } as Record<string, unknown>,
    ator_id: user.id,
  });
  revalidar();
  return { ok: true };
}
