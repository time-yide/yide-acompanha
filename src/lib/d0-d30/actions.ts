"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import type { ChecklistItem } from "./template";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verifica se o ator pode editar essa etapa específica. */
async function canEditEtapa(
  actor: { id: string; role: string },
  clientId: string,
): Promise<boolean> {
  if (["adm", "socio", "coordenador"].includes(actor.role)) return true;
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("clients")
    .select("assessor_id, coordenador_id")
    .eq("id", clientId)
    .single();
  if (!data) return false;
  return data.assessor_id === actor.id || data.coordenador_id === actor.id;
}

const toggleSchema = z.object({
  etapa_id: z.string().regex(UUID_RE),
  tipo: z.enum(["fluxo", "saidas"]),
  index: z.coerce.number().int().min(0),
  done: z
    .string()
    .transform((v) => v === "true")
    .pipe(z.boolean()),
  /** Opcional: data customizada (YYYY-MM-DD) — pra backdate de items feitos
   * antes do cliente ser cadastrado. Default = agora. */
  data_acao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

/**
 * Marca/desmarca um item específico (fluxo OU saídas) de uma etapa.
 * Atualiza `done`, `done_by` e `done_at` no JSONB.
 */
export async function toggleChecklistItemAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();

  const parsed = toggleSchema.safeParse({
    etapa_id: formData.get("etapa_id"),
    tipo: formData.get("tipo"),
    index: formData.get("index"),
    done: formData.get("done"),
    data_acao: formData.get("data_acao") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: etapa } = await sb
    .from("client_onboarding_etapas")
    .select("id, client_id, status, fluxo_checklist, saidas_checklist")
    .eq("id", parsed.data.etapa_id)
    .single();
  if (!etapa) return { error: "Etapa não encontrada" };

  if (!(await canEditEtapa(actor, etapa.client_id))) {
    return { error: "Sem permissão pra editar essa etapa" };
  }

  const field = parsed.data.tipo === "fluxo" ? "fluxo_checklist" : "saidas_checklist";
  const checklist = etapa[field] as ChecklistItem[];

  if (parsed.data.index < 0 || parsed.data.index >= checklist.length) {
    return { error: "Item inválido" };
  }

  // Backdate: se data_acao foi passada (formato YYYY-MM-DD), usa ela com
  // 12:00 do fuso APP. Default = agora.
  const acaoAt = parsed.data.done
    ? parsed.data.data_acao
      ? new Date(`${parsed.data.data_acao}T12:00:00-04:00`).toISOString()
      : new Date().toISOString()
    : null;

  const updated = checklist.map((item, i) => {
    if (i !== parsed.data.index) return item;
    return {
      ...item,
      done: parsed.data.done,
      done_by: parsed.data.done ? actor.id : null,
      done_at: acaoAt,
    };
  });

  // Auto-promove status pra "em_progresso" se algum item foi marcado e status era "pendente".
  // (Não promove pra "concluido" automaticamente — isso requer ação explícita.)
  const algumMarcado = updated.some((i) => i.done) ||
    (parsed.data.tipo === "fluxo"
      ? (etapa.saidas_checklist as ChecklistItem[]).some((i) => i.done)
      : (etapa.fluxo_checklist as ChecklistItem[]).some((i) => i.done));

  const newStatus =
    etapa.status === "pendente" && algumMarcado ? "em_progresso" : etapa.status;
  const iniciadoEm =
    newStatus === "em_progresso" && etapa.status === "pendente"
      ? new Date().toISOString()
      : undefined;

  const update: Record<string, unknown> = { [field]: updated, status: newStatus };
  if (iniciadoEm) update.iniciado_em = iniciadoEm;

  const { error } = await sb
    .from("client_onboarding_etapas")
    .update(update)
    .eq("id", parsed.data.etapa_id);
  if (error) return { error: error.message };

  revalidatePath("/d0-d30");
  revalidatePath(`/d0-d30/${etapa.client_id}`);
  return { success: true };
}

const markEtapaSchema = z.object({
  etapa_id: z.string().regex(UUID_RE),
  /** Opcional: data customizada (YYYY-MM-DD) pra backdate de etapas
   * concluídas no passado. Default = hoje. */
  data_conclusao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .nullable(),
});

/**
 * Marca etapa inteira como concluída. Só funciona se TODOS os itens de
 * `saidas_checklist` estiverem concluídos (lógica de gate). Itens de fluxo
 * podem ficar parciais.
 *
 * Aceita data_conclusao opcional pra backdate — útil quando você cadastra
 * cliente com D0 retroativo e quer marcar etapas que já foram feitas
 * efetivamente no passado.
 */
export async function markEtapaConcluidaAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();

  const parsed = markEtapaSchema.safeParse({
    etapa_id: formData.get("etapa_id"),
    data_conclusao: formData.get("data_conclusao") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: etapa } = await sb
    .from("client_onboarding_etapas")
    .select("id, client_id, status, saidas_checklist, etapa_codigo")
    .eq("id", parsed.data.etapa_id)
    .single();
  if (!etapa) return { error: "Etapa não encontrada" };

  if (!(await canEditEtapa(actor, etapa.client_id))) {
    return { error: "Sem permissão" };
  }

  const saidas = etapa.saidas_checklist as ChecklistItem[];
  const todasSaidasFeitas = saidas.every((i) => i.done);
  if (!todasSaidasFeitas) {
    return {
      error:
        "Pra concluir a etapa, primeiro marque todas as 'Saídas obrigatórias' como feitas",
    };
  }

  if (etapa.status === "concluido") return { success: true };

  // Backdate: se data_conclusao foi passada, usa ela (com hora=12:00 do fuso
  // pra evitar problemas de borda de dia). Default = agora.
  const concluidoEm = parsed.data.data_conclusao
    ? new Date(`${parsed.data.data_conclusao}T12:00:00-04:00`).toISOString()
    : new Date().toISOString();

  const { error } = await sb
    .from("client_onboarding_etapas")
    .update({
      status: "concluido",
      concluido_em: concluidoEm,
      concluido_por: actor.id,
    })
    .eq("id", parsed.data.etapa_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_onboarding_etapas",
    entidade_id: parsed.data.etapa_id,
    acao: "complete",
    dados_depois: { etapa_codigo: etapa.etapa_codigo },
    ator_id: actor.id,
  });

  revalidatePath("/d0-d30");
  revalidatePath(`/d0-d30/${etapa.client_id}`);
  return { success: true };
}

const reabrirSchema = z.object({
  etapa_id: z.string().regex(UUID_RE),
});

/** Reabre uma etapa concluída — caso tenha sido marcada errada. */
export async function reabrirEtapaAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!["adm", "socio", "coordenador"].includes(actor.role)) {
    return { error: "Apenas coord/adm/sócio podem reabrir etapas" };
  }

  const parsed = reabrirSchema.safeParse({ etapa_id: formData.get("etapa_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: etapa } = await sb
    .from("client_onboarding_etapas")
    .select("id, client_id")
    .eq("id", parsed.data.etapa_id)
    .single();
  if (!etapa) return { error: "Etapa não encontrada" };

  const { error } = await sb
    .from("client_onboarding_etapas")
    .update({ status: "em_progresso", concluido_em: null, concluido_por: null })
    .eq("id", parsed.data.etapa_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_onboarding_etapas",
    entidade_id: parsed.data.etapa_id,
    acao: "reopen",
    ator_id: actor.id,
  });

  revalidatePath("/d0-d30");
  revalidatePath(`/d0-d30/${etapa.client_id}`);
  return { success: true };
}

const observacoesSchema = z.object({
  etapa_id: z.string().regex(UUID_RE),
  observacoes: z.string().max(5000),
});

export async function salvarObservacoesAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();

  const parsed = observacoesSchema.safeParse({
    etapa_id: formData.get("etapa_id"),
    observacoes: formData.get("observacoes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: etapa } = await sb
    .from("client_onboarding_etapas")
    .select("id, client_id")
    .eq("id", parsed.data.etapa_id)
    .single();
  if (!etapa) return { error: "Etapa não encontrada" };

  if (!(await canEditEtapa(actor, etapa.client_id))) {
    return { error: "Sem permissão" };
  }

  const { error } = await sb
    .from("client_onboarding_etapas")
    .update({ observacoes: parsed.data.observacoes.trim() || null })
    .eq("id", parsed.data.etapa_id);
  if (error) return { error: error.message };

  revalidatePath(`/d0-d30/${etapa.client_id}`);
  return { success: true };
}

const addClienteSchema = z.object({
  client_id: z.string().regex(UUID_RE),
  d0_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)"),
});

/**
 * Adiciona manualmente um cliente ao D0-D30 (pra catch-up de clientes que já
 * existiam ou foram cadastrados sem trigger). Yasmin escolhe a data D0.
 */
export async function adicionarClienteManualAction(
  formData: FormData,
): Promise<{ success: true } | { error: string }> {
  const actor = await requireAuth();
  if (!["adm", "socio", "coordenador"].includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = addClienteSchema.safeParse({
    client_id: formData.get("client_id"),
    d0_date: formData.get("d0_date"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Confirma que cliente existe e não tem etapas ainda
  const { data: cliente } = await sb
    .from("clients")
    .select("id, status")
    .eq("id", parsed.data.client_id)
    .single();
  if (!cliente) return { error: "Cliente não encontrado" };

  const { data: existing } = await sb
    .from("client_onboarding_etapas")
    .select("id")
    .eq("client_id", parsed.data.client_id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { error: "Esse cliente já tem onboarding iniciado" };
  }

  // Chama a função stored procedure no banco que faz o seed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (admin.rpc as any)("seed_client_onboarding_etapas", {
    p_client_id: parsed.data.client_id,
    p_d0_date: parsed.data.d0_date,
  });
  if (rpcError) return { error: rpcError.message };

  await logAudit({
    entidade: "client_onboarding_etapas",
    entidade_id: parsed.data.client_id,
    acao: "create",
    dados_depois: { adicionado_manualmente: true, d0_date: parsed.data.d0_date },
    ator_id: actor.id,
    justificativa: "Onboarding D0-D30 adicionado manualmente",
  });

  revalidatePath("/d0-d30");
  return { success: true };
}
