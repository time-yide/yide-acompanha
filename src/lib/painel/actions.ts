"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { resolveNextStep, isParallelStep, getResponsavelFor, type ClienteRefs } from "./chain";
import { PAINEL_CACHE_TAG } from "./queries";
import type { StepKey } from "./deadlines";
import { PACOTES_NO_PAINEL_MENSAL, PACOTE_COLUMNS, type ColumnKey, type TipoPacote } from "./pacote-matrix";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

// UUID regex that accepts any hex UUID (including test UUIDs that don't satisfy RFC variant bits)
const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

const markProntoSchema = z.object({
  step_id: uuidLike,
});

const ALLOWED_FIELDS = ["pacote_post", "quantidade_postada", "valor_trafego_mes"] as const;
const updateFieldSchema = z.object({
  checklist_id: uuidLike,
  field: z.enum(ALLOWED_FIELDS),
  value: z.string(),
});

export async function markStepProntoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = markProntoSchema.safeParse({ step_id: formData.get("step_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Carrega step + checklist + cliente refs
  const { data: stepData } = await supabase
    .from("checklist_step")
    .select("id, checklist_id, step_key, status, responsavel_id, client_monthly_checklist:client_monthly_checklist(id, client_id, cliente:clients(id, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id))")
    .eq("id", parsed.data.step_id)
    .single();

  if (!stepData) return { error: "Etapa não encontrada" };

  const step = stepData as unknown as {
    id: string;
    checklist_id: string;
    step_key: StepKey;
    status: string;
    responsavel_id: string | null;
    client_monthly_checklist: {
      id: string;
      client_id: string;
      cliente: ClienteRefs;
    };
  };

  const cliente = step.client_monthly_checklist.cliente;

  // Atualiza step atual como pronto
  const { error: updateErr } = await supabase
    .from("checklist_step")
    .update({
      status: "pronto",
      completed_at: new Date().toISOString(),
      completed_by: actor.id,
    })
    .eq("id", step.id);
  if (updateErr) return { error: updateErr.message };

  // Caso especial: camera ou mobile pronto → checa se o outro já está pronto
  const nextCtx: { cameraAlreadyPronto?: boolean; mobileAlreadyPronto?: boolean } = {};
  if (step.step_key === "camera" || step.step_key === "mobile") {
    const otherKey = step.step_key === "camera" ? "mobile" : "camera";
    const { data: otherSteps } = await supabase
      .from("checklist_step")
      .select("status")
      .eq("checklist_id", step.checklist_id)
      .eq("step_key", otherKey);
    const isOtherPronto = (otherSteps ?? []).some((s) => (s as { status: string }).status === "pronto");
    if (step.step_key === "camera") nextCtx.mobileAlreadyPronto = isOtherPronto;
    else nextCtx.cameraAlreadyPronto = isOtherPronto;
  }

  // Resolve próxima etapa
  const nextStep = resolveNextStep(step.step_key, cliente, nextCtx);

  if (nextStep) {
    await supabase.from("checklist_step").upsert(
      {
        checklist_id: step.checklist_id,
        step_key: nextStep.next,
        status: "em_andamento",
        responsavel_id: nextStep.responsavel_id,
        iniciado_em: new Date().toISOString(),
      },
      { onConflict: "checklist_id,step_key" },
    );

    // dispatchNotification uses user_ids_extras for individual targeting
    // (notification_rules determines default roles; user_ids_extras adds specific recipients)
    if (nextStep.responsavel_id) {
      await dispatchNotification({
        evento_tipo: "checklist_step_delegada",
        titulo: `Etapa "${nextStep.next}" delegada pra você`,
        mensagem: `Cliente — fase ${nextStep.next} aguardando você`,
        link: "/painel",
        user_ids_extras: [nextStep.responsavel_id],
      });
    } else if (cliente.coordenador_id) {
      await dispatchNotification({
        evento_tipo: "checklist_step_delegada",
        titulo: `Defina ${nextStep.next} pra cliente`,
        mensagem: `Cliente sem responsável cadastrado pra etapa ${nextStep.next}`,
        link: "/painel",
        user_ids_extras: [cliente.coordenador_id],
      });
    }
  } else if (isParallelStep(step.step_key)) {
    // Paralela concluída → notifica via regras (Coord/Sócios conforme notification_rules)
    await dispatchNotification({
      evento_tipo: "checklist_step_concluida",
      titulo: `Etapa "${step.step_key}" concluída`,
      mensagem: `Por ${actor.nome}`,
      link: "/painel",
    });
  }

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

export async function updateChecklistFieldAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = updateFieldSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    field: formData.get("field"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const numericValue = Number(parsed.data.value);
  if (Number.isNaN(numericValue)) return { error: "Valor inválido" };

  const supabase = await createClient();

  // Build update object with explicit typing to satisfy Supabase's strict row type
  const updatePayload =
    parsed.data.field === "pacote_post"
      ? { pacote_post: numericValue }
      : parsed.data.field === "quantidade_postada"
        ? { quantidade_postada: numericValue }
        : { valor_trafego_mes: numericValue };

  const { error } = await supabase
    .from("client_monthly_checklist")
    .update(updatePayload)
    .eq("id", parsed.data.checklist_id);

  if (error) return { error: error.message };

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

// =============================================
// Fase 1 — actions novas
// =============================================

const setGmnSchema = z.object({
  checklist_id: uuidLike,
  gmn_comentarios: z.coerce.number().int().min(0),
  gmn_avaliacoes: z.coerce.number().int().min(0),
  gmn_nota_media: z.coerce.number().min(0).max(5).nullable().optional(),
  gmn_observacoes: z.string().max(2000).nullable().optional(),
  gmn_otimizado: z.coerce.boolean(),
});

export async function setGmnDataAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setGmnSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    gmn_comentarios: formData.get("gmn_comentarios"),
    gmn_avaliacoes: formData.get("gmn_avaliacoes"),
    gmn_nota_media: formData.get("gmn_nota_media") || null,
    gmn_observacoes: formData.get("gmn_observacoes") || null,
    gmn_otimizado: formData.get("gmn_otimizado") === "true" || formData.get("gmn_otimizado") === "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_checklist")
    .update({
      gmn_comentarios: parsed.data.gmn_comentarios,
      gmn_avaliacoes: parsed.data.gmn_avaliacoes,
      gmn_nota_media: parsed.data.gmn_nota_media ?? null,
      gmn_observacoes: parsed.data.gmn_observacoes ?? null,
      gmn_otimizado: parsed.data.gmn_otimizado,
    })
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

const setTpgTpmSchema = z.object({
  checklist_id: uuidLike,
  field: z.enum(["tpg_ativo", "tpm_ativo"]),
  ativo: z.coerce.boolean(),
});

export async function setTpgTpmAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setTpgTpmSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    field: formData.get("field"),
    ativo: formData.get("ativo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const payload = parsed.data.field === "tpg_ativo"
    ? { tpg_ativo: parsed.data.ativo }
    : { tpm_ativo: parsed.data.ativo };

  const { error } = await supabase
    .from("client_monthly_checklist")
    .update(payload)
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

const setMonthlyPostsSchema = z.object({
  checklist_id: uuidLike,
  pacote_post: z.coerce.number().int().min(0),
  quantidade_postada: z.coerce.number().int().min(0),
});

export async function setMonthlyPostsAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setMonthlyPostsSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    pacote_post: formData.get("pacote_post"),
    quantidade_postada: formData.get("quantidade_postada"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_checklist")
    .update({
      pacote_post: parsed.data.pacote_post,
      quantidade_postada: parsed.data.quantidade_postada,
    })
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

const delegarDesignSchema = z.object({
  step_id: uuidLike,
});

export async function delegarDesignAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = delegarDesignSchema.safeParse({ step_id: formData.get("step_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: step } = await supabase
    .from("checklist_step")
    .select("id, step_key, status, responsavel_id, client_monthly_checklist(client_id, cliente:clients(designer_id))")
    .eq("id", parsed.data.step_id)
    .single();

  if (!step) return { error: "Etapa não encontrada" };
  const s = step as unknown as {
    id: string;
    step_key: string;
    status: string;
    responsavel_id: string | null;
    client_monthly_checklist: {
      client_id: string;
      cliente: { designer_id: string | null };
    };
  };

  if (s.step_key !== "design") return { error: "Action só para design" };

  const designerId = s.client_monthly_checklist.cliente.designer_id;
  if (!designerId) return { error: "Cliente sem designer cadastrado" };

  const { error } = await supabase
    .from("checklist_step")
    .update({
      status: "delegado",
      responsavel_id: designerId,
      iniciado_em: new Date().toISOString(),
    })
    .eq("id", s.id);
  if (error) return { error: error.message };

  await dispatchNotification({
    evento_tipo: "checklist_step_delegada",
    titulo: `Design delegado pra você`,
    mensagem: `Por ${actor.nome}`,
    link: "/painel",
    user_ids_extras: [designerId],
  });

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true };
}

// =============================================
// Ensure monthly checklists — botão "Atualizar painel"
// =============================================

/** Mapeia coluna do painel pro step_key correspondente. */
const COLUMN_TO_STEP: Record<ColumnKey, StepKey> = {
  crono: "cronograma",
  design: "design",
  tpg: "tpg",
  tpm: "tpm",
  gmn: "gmn_post",
  camera: "camera",
  mobile: "mobile",
  edicao: "edicao",
  reuniao: "reuniao",
  pacote_postados: "postagem",
};

const ROLES_QUE_ATUALIZAM_PAINEL = ["adm", "socio", "coordenador"];

const ensureMonthlyChecklistsSchema = z.object({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado YYYY-MM"),
});

interface EnsureResult {
  success?: true;
  error?: string;
  checklistsCriados?: number;
  stepsCriados?: number;
}

/**
 * Garante que existe um client_monthly_checklist + checklist_steps pra cada
 * cliente ativo elegível (tipo_pacote no painel) pro mês especificado.
 * Idempotente — se já existe, não duplica.
 *
 * Usa service-role pq a RLS policy bloqueia INSERT/DELETE pra qualquer role
 * autenticado (só service-role pode inserir).
 *
 * Acesso: adm, sócio, coordenador.
 */
export async function ensureMonthlyChecklistsAction(formData: FormData): Promise<EnsureResult> {
  const actor = await requireAuth();
  if (!ROLES_QUE_ATUALIZAM_PAINEL.includes(actor.role)) {
    return { error: "Sem permissão pra atualizar o painel" };
  }

  const parsed = ensureMonthlyChecklistsSchema.safeParse({
    mes_referencia: formData.get("mes_referencia"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const mes = parsed.data.mes_referencia;
  const supabase = createServiceRoleClient();

  // 1) Lista clientes ativos elegíveis
  const { data: clientsData, error: clientsErr } = await supabase
    .from("clients")
    .select("id, organization_id, tipo_pacote, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id")
    .eq("status", "ativo")
    .in("tipo_pacote", [...PACOTES_NO_PAINEL_MENSAL]);
  if (clientsErr) return { error: clientsErr.message };
  const clients = (clientsData ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: TipoPacote;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
  }>;
  if (clients.length === 0) return { success: true, checklistsCriados: 0, stepsCriados: 0 };

  const clientIds = clients.map((c) => c.id);

  // 2) Lista checklists existentes pro mês
  const { data: existingData } = await supabase
    .from("client_monthly_checklist")
    .select("id, client_id")
    .eq("mes_referencia", mes)
    .in("client_id", clientIds);
  const existing = (existingData ?? []) as Array<{ id: string; client_id: string }>;
  const existingByClient = new Map(existing.map((e) => [e.client_id, e.id]));

  // 3) INSERT checklists faltantes
  const toInsertChecklists = clients
    .filter((c) => !existingByClient.has(c.id))
    .map((c) => ({
      client_id: c.id,
      organization_id: c.organization_id,
      mes_referencia: mes,
    }));

  let checklistsCriados = 0;
  if (toInsertChecklists.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("client_monthly_checklist")
      .insert(toInsertChecklists)
      .select("id, client_id");
    if (insErr) return { error: insErr.message };
    checklistsCriados = inserted?.length ?? 0;
    for (const row of (inserted ?? []) as Array<{ id: string; client_id: string }>) {
      existingByClient.set(row.client_id, row.id);
    }
  }

  // 4) Pra cada checklist (novo ou existente), garante os step rows aplicáveis
  // ao tipo_pacote do cliente. Usa upsert com onConflict pra ficar idempotente.
  const stepRowsToUpsert: Array<{
    checklist_id: string;
    step_key: StepKey;
    status: "pendente";
    responsavel_id: string | null;
  }> = [];

  for (const client of clients) {
    const checklistId = existingByClient.get(client.id);
    if (!checklistId) continue;
    const columns = PACOTE_COLUMNS[client.tipo_pacote];
    for (const col of Object.keys(columns) as ColumnKey[]) {
      if (columns[col] !== 1) continue;
      const stepKey = COLUMN_TO_STEP[col];
      stepRowsToUpsert.push({
        checklist_id: checklistId,
        step_key: stepKey,
        status: "pendente",
        responsavel_id: getResponsavelFor(stepKey, {
          id: client.id,
          assessor_id: client.assessor_id,
          coordenador_id: client.coordenador_id,
          designer_id: client.designer_id,
          videomaker_id: client.videomaker_id,
          editor_id: client.editor_id,
        }),
      });
    }
  }

  let stepsCriados = 0;
  if (stepRowsToUpsert.length > 0) {
    // onConflict: (checklist_id, step_key) é a unique constraint da tabela
    const { data: upserted, error: stepsErr } = await supabase
      .from("checklist_step")
      .upsert(stepRowsToUpsert, {
        onConflict: "checklist_id,step_key",
        ignoreDuplicates: true,
      })
      .select("id");
    if (stepsErr) return { error: stepsErr.message };
    stepsCriados = upserted?.length ?? 0;
  }

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  return { success: true, checklistsCriados, stepsCriados };
}
