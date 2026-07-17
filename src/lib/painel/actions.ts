"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { resolveNextStep, isParallelStep, type ClienteRefs } from "./chain";
import { PAINEL_CACHE_TAG } from "./queries";
import { ensureMonthlyChecklistsImpl } from "./ensure-checklists";
import type { StepKey } from "./deadlines";

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
        mensagem: `Cliente · fase ${nextStep.next} aguardando você`,
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
// Fase 1 - actions novas
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

const uploadCronogramaSchema = z.object({
  client_id: uuidLike,
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado YYYY-MM"),
  cronograma_url: z.string().url("Link inválido"),
  // Artes/posts (pacote_post) e vídeos (pacote_video) do cronograma.
  quantidade: z.coerce.number().int().min(0),
  quantidade_videos: z.coerce.number().int().min(0).default(0),
});

/**
 * Upload do cronograma mensal (Parte A do spec painel-cronograma-design).
 *
 * - Grava `cronograma_url` + `pacote_post` (artes) + `pacote_video` (vídeos)
 *   no `client_monthly_checklist` do mês (upsert por client_id,mes_referencia).
 * - Cria automaticamente uma tarefa "arte" pro designer do cliente
 *   (fallback: coordenador, depois o próprio ator). Guarda o id em
 *   `design_task_id`. Re-upload NÃO cria segunda tarefa.
 *
 * Mesmo gate/serviço do setMonthlyPostsAction (requireAuth + createClient).
 * `as any` nos writes porque as colunas novas (cronograma_url, design_task_id)
 * ainda não estão nos tipos gerados — mesmo padrão de createTaskAction.
 */
export async function uploadCronogramaAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = uploadCronogramaSchema.safeParse({
    client_id: formData.get("client_id"),
    mes_referencia: formData.get("mes_referencia"),
    cronograma_url: formData.get("cronograma_url"),
    quantidade: formData.get("quantidade"),
    quantidade_videos: formData.get("quantidade_videos") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Estado atual do checklist do mês (pra saber se já existe design_task_id).
  const { data: existing } = await sb
    .from("client_monthly_checklist")
    .select("id, design_task_id")
    .eq("client_id", parsed.data.client_id)
    .eq("mes_referencia", parsed.data.mes_referencia)
    .maybeSingle();

  const existingTaskId: string | null = existing?.design_task_id ?? null;

  // organization_id é NOT NULL em client_monthly_checklist. No caminho de INSERT
  // (cliente ainda sem linha do mês) o upsert precisa mandar a org do cliente,
  // igual o ensure-checklists faz — senão quebra o not-null constraint.
  const { data: clienteOrg } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (!clienteOrg?.organization_id) return { error: "Cliente sem organização" };

  // Cria a tarefa do designer só na primeira vez (evita duplicar no re-upload).
  let designTaskId: string | null = existingTaskId;
  if (!existingTaskId) {
    const { data: cliente } = await sb
      .from("clients")
      .select("id, nome, designer_id, coordenador_id, assessor_id")
      .eq("id", parsed.data.client_id)
      .single();

    if (!cliente) return { error: "Cliente não encontrado" };

    const atribuidoA: string =
      cliente.designer_id ?? cliente.coordenador_id ?? actor.id;

    // Assessor do cliente entra como participante pra sempre poder ver,
    // editar e mover a tarefa do cliente dele (sem tirar do executor).
    const participantesIds: string[] =
      cliente.assessor_id && cliente.assessor_id !== atribuidoA
        ? [cliente.assessor_id]
        : [];

    // Nome da tarefa: "Cronograma AGOSTO - Nome do Cliente" (mês por extenso,
    // derivado do mes_referencia "YYYY-MM").
    const MESES_PT = [
      "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
      "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
    ];
    const mesNumero = Number(parsed.data.mes_referencia.split("-")[1]);
    const mesNome = MESES_PT[mesNumero - 1] ?? parsed.data.mes_referencia;

    const insertPayload = {
      titulo: `Cronograma ${mesNome} - ${cliente.nome}`,
      descricao: `Cronograma do mês: ${parsed.data.cronograma_url}\nDemanda: ${parsed.data.quantidade} arte(s) · ${parsed.data.quantidade_videos} vídeo(s)`,
      prioridade: "media" as const,
      tipo: "arte" as const,
      formatos: ["feed"],
      status_aprovacao: "pendente_envio" as const,
      atribuido_a: atribuidoA,
      participantes_ids: participantesIds,
      client_id: parsed.data.client_id,
      criado_por: actor.id,
    };

    const { data: created, error: taskErr } = await sb
      .from("tasks")
      .insert(insertPayload)
      .select("id, titulo")
      .single();
    if (taskErr || !created) {
      return { error: taskErr?.message ?? "Falha ao criar tarefa de design" };
    }
    designTaskId = created.id;

    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "Nova tarefa atribuída a você",
      mensagem: `${actor.nome} atribuiu: "${created.titulo}"`,
      link: `/tarefas/${created.id}`,
      user_ids_extras: [atribuidoA],
      source_user_id: actor.id,
    });
  }

  // Upsert do checklist com o link + quantidade (+ design_task_id na 1ª vez).
  const checklistPayload: Record<string, unknown> = {
    client_id: parsed.data.client_id,
    organization_id: clienteOrg.organization_id,
    mes_referencia: parsed.data.mes_referencia,
    cronograma_url: parsed.data.cronograma_url,
    pacote_post: parsed.data.quantidade,
    pacote_video: parsed.data.quantidade_videos,
  };
  if (designTaskId) checklistPayload.design_task_id = designTaskId;

  const { data: upserted, error: upsertErr } = await sb
    .from("client_monthly_checklist")
    .upsert(checklistPayload, { onConflict: "client_id,mes_referencia" })
    .select("id");
  if (upsertErr) return { error: upsertErr.message };
  // RLS deny em UPDATE/UPSERT é silencioso (0 linhas, sem erro) — convenção do projeto.
  if (!upserted || upserted.length === 0) {
    return { error: "Sem permissão pra salvar o cronograma" };
  }

  revalidatePath("/painel");
  revalidateTag(PAINEL_CACHE_TAG, "default");
  revalidateTag("tasks", "default");
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
// Ensure monthly checklists - botão "Atualizar painel"
// =============================================

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
 * Server action do botão "Atualizar painel". Valida permissão e delega
 * pra `ensureMonthlyChecklistsImpl` que tem a lógica de fato.
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

  try {
    const result = await ensureMonthlyChecklistsImpl(parsed.data.mes_referencia);
    revalidatePath("/painel");
    revalidateTag(PAINEL_CACHE_TAG, "default");
    return { success: true, ...result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
