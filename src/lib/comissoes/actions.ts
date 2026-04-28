"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { adjustmentSchema, approveSchema } from "./schema";

function formatMonth(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const names = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${names[Number(month) - 1]} ${year}`;
}

export async function adjustSnapshotAction(formData: FormData) {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas Sócio pode ajustar" };

  const parsed = adjustmentSchema.safeParse({
    snapshot_id: formData.get("snapshot_id"),
    novo_valor_variavel: formData.get("novo_valor_variavel"),
    justificativa: formData.get("justificativa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("commission_snapshots")
    .select("*")
    .eq("id", parsed.data.snapshot_id)
    .single();
  if (!before) return { error: "Snapshot não encontrado" };
  if (before.status === "aprovado") return { error: "Mês já aprovado, não pode ajustar" };

  const valorCalculadoOriginal = Number(before.valor_variavel) - Number(before.ajuste_manual);
  const novoValorVariavel = parsed.data.novo_valor_variavel;
  const novoAjuste = Math.round((novoValorVariavel - valorCalculadoOriginal) * 100) / 100;
  const novoValorTotal = Math.round((Number(before.fixo) + novoValorVariavel) * 100) / 100;

  const { error } = await supabase
    .from("commission_snapshots")
    .update({
      valor_variavel: novoValorVariavel,
      ajuste_manual: novoAjuste,
      valor_total: novoValorTotal,
      justificativa_ajuste: novoAjuste === 0 ? null : parsed.data.justificativa,
    })
    .eq("id", parsed.data.snapshot_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "commission_snapshots",
    entidade_id: parsed.data.snapshot_id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: {
      valor_variavel: novoValorVariavel,
      ajuste_manual: novoAjuste,
      valor_total: novoValorTotal,
      justificativa_ajuste: parsed.data.justificativa,
    },
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  revalidatePath("/comissoes/fechamento");
  revalidatePath("/comissoes/visao-geral");
  return { success: true };
}

export async function approveMonthAction(formData: FormData) {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas Sócio pode aprovar" };

  const parsed = approveSchema.safeParse({ mes_referencia: formData.get("mes_referencia") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: snaps } = await supabase
    .from("commission_snapshots")
    .select("id, user_id, valor_total")
    .eq("mes_referencia", parsed.data.mes_referencia)
    .eq("status", "pending_approval");
  if (!snaps || snaps.length === 0) {
    return { error: "Nenhum snapshot pendente neste mês" };
  }

  if (snaps.some((s) => Number(s.valor_total) < 0)) {
    return { error: "Há snapshots com valor total negativo. Corrija antes de aprovar." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("commission_snapshots")
    .update({ status: "aprovado", aprovado_por: actor.id, aprovado_em: now })
    .eq("mes_referencia", parsed.data.mes_referencia)
    .eq("status", "pending_approval");
  if (error) return { error: error.message };

  await logAudit({
    entidade: "commission_snapshots",
    entidade_id: parsed.data.mes_referencia,
    acao: "approve",
    dados_depois: {
      status: "aprovado",
      aprovado_por: actor.id,
      aprovado_em: now,
      count: snaps.length,
    },
    ator_id: actor.id,
  });

  await dispatchNotification({
    evento_tipo: "mes_aprovado",
    titulo: `Comissão de ${formatMonth(parsed.data.mes_referencia)} aprovada`,
    mensagem: `Sua comissão deste mês foi aprovada. Valor disponível em /comissoes/minhas`,
    link: "/comissoes/minhas",
    user_ids_extras: snaps.map((s) => s.user_id),
    source_user_id: actor.id,
  });

  revalidatePath("/comissoes/fechamento");
  revalidatePath("/comissoes/visao-geral");
  revalidatePath("/comissoes/minhas");
  return { success: true, count: snaps.length };
}
