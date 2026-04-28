"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { resolveNextStep, isParallelStep, type ClienteRefs } from "./chain";
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
  let nextCtx: { cameraAlreadyPronto?: boolean; mobileAlreadyPronto?: boolean } = {};
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
  return { success: true };
}
