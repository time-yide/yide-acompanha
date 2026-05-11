"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AUDIOVISUAL_PENDENTE_TAG, AUDIOVISUAL_CAPTURAS_TAG } from "./queries";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { isoWeek } from "@/lib/satisfacao/iso-week";
import { createCapturaSchema, RATING_FIELDS } from "./schema";
import { avgRating } from "./queries";

const RATING_LABEL_BY_NAME = new Map<string, string>(
  RATING_FIELDS.map((f) => [f.name, f.label]),
);

/**
 * Mapeia erro do zod pra mensagem amigável. Notas faltando viram "Falta
 * avaliar: <label>" em vez do críptico "expected number, received NaN".
 */
function friendlyZodError(issue: { path: PropertyKey[]; message: string }): string {
  const field = issue.path[0];
  if (typeof field === "string") {
    const label = RATING_LABEL_BY_NAME.get(field);
    if (label) return `Falta avaliar: ${label}`;
  }
  return issue.message;
}

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

type ActionResult = { error?: string } | undefined;

/**
 * Mapeia média 1-5 pra cor verde/amarelo/vermelho do sistema de satisfação.
 * 4-5 = verde · 3 = amarelo · 1-2 = vermelho.
 */
function mediaParaCor(media: number): "verde" | "amarelo" | "vermelho" {
  if (media >= 3.5) return "verde";
  if (media >= 2.5) return "amarelo";
  return "vermelho";
}

function comentarioFromCaptura(args: {
  qtdVideos: number;
  qtdFotos: number;
  pontos_positivos?: string | null;
  pontos_dificuldade?: string | null;
  sugestoes?: string | null;
  observacoes?: string | null;
}): string {
  const partes: string[] = [];
  partes.push(`Captação: ${args.qtdVideos} vídeo(s), ${args.qtdFotos} foto(s).`);
  if (args.pontos_positivos) partes.push(`Pontos positivos: ${args.pontos_positivos}`);
  if (args.pontos_dificuldade) partes.push(`Dificuldades: ${args.pontos_dificuldade}`);
  if (args.sugestoes) partes.push(`Sugestões: ${args.sugestoes}`);
  if (args.observacoes) partes.push(`Observações: ${args.observacoes}`);
  return partes.join("\n\n").slice(0, 2000);
}

export async function createCapturaAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();

  const parsed = createCapturaSchema.safeParse({
    event_id: fd(formData, "event_id"),
    client_id: fd(formData, "client_id"),
    data_captacao: fd(formData, "data_captacao"),
    drive_url: fd(formData, "drive_url"),
    qtd_videos: fd(formData, "qtd_videos") ?? "0",
    qtd_fotos: fd(formData, "qtd_fotos") ?? "0",
    observacoes: fd(formData, "observacoes"),
    rating_organizacao: fd(formData, "rating_organizacao"),
    rating_facilidade: fd(formData, "rating_facilidade"),
    rating_execucao_roteiro: fd(formData, "rating_execucao_roteiro"),
    rating_atrasos: fd(formData, "rating_atrasos"),
    rating_comunicacao: fd(formData, "rating_comunicacao"),
    rating_retrabalho: fd(formData, "rating_retrabalho"),
    rating_colaboracao: fd(formData, "rating_colaboracao"),
    pontos_positivos: fd(formData, "pontos_positivos"),
    pontos_dificuldade: fd(formData, "pontos_dificuldade"),
    sugestoes: fd(formData, "sugestoes"),
  });

  if (!parsed.success) return { error: friendlyZodError(parsed.error.issues[0]) };

  const supabase = await createClient();
  const insertPayload = {
    event_id: parsed.data.event_id || null,
    client_id: parsed.data.client_id,
    videomaker_id: actor.id,
    data_captacao: parsed.data.data_captacao,
    drive_url: parsed.data.drive_url,
    qtd_videos: parsed.data.qtd_videos,
    qtd_fotos: parsed.data.qtd_fotos,
    observacoes: parsed.data.observacoes ?? null,
    rating_organizacao: parsed.data.rating_organizacao,
    rating_facilidade: parsed.data.rating_facilidade,
    rating_execucao_roteiro: parsed.data.rating_execucao_roteiro,
    rating_atrasos: parsed.data.rating_atrasos,
    rating_comunicacao: parsed.data.rating_comunicacao,
    rating_retrabalho: parsed.data.rating_retrabalho,
    rating_colaboracao: parsed.data.rating_colaboracao,
    pontos_positivos: parsed.data.pontos_positivos ?? null,
    pontos_dificuldade: parsed.data.pontos_dificuldade ?? null,
    sugestoes: parsed.data.sugestoes ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: created, error } = await sb
    .from("audiovisual_capturas")
    .insert(insertPayload)
    .select("id, client_id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao registrar captação" };

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  // Integração com satisfação: UPSERT entry do videomaker pra esse cliente na semana
  // da captação. Se já existir entry da semana, atualiza com a cor/comentário desta.
  const media = avgRating(insertPayload);
  if (media !== null) {
    const semanaIso = isoWeek(new Date(parsed.data.data_captacao + "T12:00:00Z"));
    const cor = mediaParaCor(media);
    const comentario = comentarioFromCaptura({
      qtdVideos: parsed.data.qtd_videos,
      qtdFotos: parsed.data.qtd_fotos,
      pontos_positivos: parsed.data.pontos_positivos,
      pontos_dificuldade: parsed.data.pontos_dificuldade,
      sugestoes: parsed.data.sugestoes,
      observacoes: parsed.data.observacoes,
    });

    await sb
      .from("satisfaction_entries")
      .upsert(
        {
          client_id: parsed.data.client_id,
          autor_id: actor.id,
          papel_autor: "videomaker",
          semana_iso: semanaIso,
          cor,
          comentario,
        },
        { onConflict: "client_id,autor_id,semana_iso" },
      );
  }

  // Notifica coord/assessor responsáveis pelo cliente
  const { data: client } = await supabase
    .from("clients")
    .select("nome, assessor_id, coordenador_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (client) {
    const recipients = [client.assessor_id, client.coordenador_id]
      .filter((id): id is string => !!id && id !== actor.id);
    if (recipients.length > 0) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Captação entregue",
        mensagem: `${actor.nome} entregou captação de ${client.nome}`,
        link: `/audiovisual`,
        user_ids_extras: recipients,
        source_user_id: actor.id,
      });
    }
  }

  revalidatePath("/audiovisual");
  revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  revalidatePath("/satisfacao");
  revalidateTag(AUDIOVISUAL_PENDENTE_TAG, "default");
  redirect("/audiovisual?toast=entregue");
}

const ROLES_QUE_DELEGAM = new Set(["audiovisual_chefe", "adm", "socio"]);

interface DelegateResult {
  error?: string;
  success?: boolean;
  taskId?: string;
}

/**
 * Delega uma captação pra um editor — cria uma tarefa atribuída ao editor
 * com link do Drive + observações da captação, e linka via task_id.
 *
 * Permissão: audiovisual_chefe, adm, sócio.
 *
 * Idempotência: se a captação já tem task_id (já delegada), retorna erro
 * pedindo pra "redelegar" (futuro: action de re-delegar).
 */
export async function delegateCapturaAction(formData: FormData): Promise<DelegateResult> {
  const actor = await requireAuth();
  if (!ROLES_QUE_DELEGAM.has(actor.role)) {
    return { error: "Apenas coord. audiovisual, adm ou sócio podem delegar" };
  }

  const capturaId = String(formData.get("captura_id") ?? "");
  const editorId = String(formData.get("editor_id") ?? "");
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  if (!capturaId) return { error: "Captação não informada" };
  if (!editorId) return { error: "Selecione um editor" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Carrega captura
  const { data: captura } = await sb
    .from("audiovisual_capturas")
    .select(`
      id, client_id, drive_url, qtd_videos, qtd_fotos,
      pontos_positivos, pontos_dificuldade, sugestoes, observacoes,
      task_id, data_captacao,
      cliente:clients(id, nome)
    `)
    .eq("id", capturaId)
    .maybeSingle();
  if (!captura) return { error: "Captação não encontrada" };
  if (captura.task_id) return { error: "Captação já foi delegada" };

  // Valida editor (precisa ter role=editor e estar ativo)
  const { data: editor } = await sb
    .from("profiles")
    .select("id, role, ativo, nome")
    .eq("id", editorId)
    .maybeSingle();
  if (!editor || !editor.ativo) return { error: "Editor não encontrado ou inativo" };
  if (editor.role !== "editor") return { error: "Pessoa selecionada não é editor" };

  // Monta título e descrição da task
  const clienteNome = captura.cliente?.nome ?? "—";
  const dataBr = captura.data_captacao
    ? new Date(captura.data_captacao + "T12:00:00Z").toLocaleDateString("pt-BR")
    : "";
  const titulo = `Editar: ${clienteNome}${dataBr ? ` (${dataBr})` : ""}`;

  const descricaoLines: string[] = [];
  descricaoLines.push(`📹 ${captura.qtd_videos} vídeo(s) · 📷 ${captura.qtd_fotos} foto(s)`);
  if (captura.drive_url) descricaoLines.push(`Drive: ${captura.drive_url}`);
  if (captura.pontos_positivos) descricaoLines.push(`✅ Positivos: ${captura.pontos_positivos}`);
  if (captura.pontos_dificuldade) descricaoLines.push(`⚠️ Dificuldades: ${captura.pontos_dificuldade}`);
  if (captura.sugestoes) descricaoLines.push(`💡 Sugestões: ${captura.sugestoes}`);
  if (captura.observacoes) descricaoLines.push(`Obs.: ${captura.observacoes}`);
  const descricao = descricaoLines.join("\n\n");

  // Cria a task. tipo="geral" pra evitar exigência de formatos.
  const { data: createdTask, error: taskErr } = await sb
    .from("tasks")
    .insert({
      titulo,
      descricao,
      prioridade: "media",
      status: "aberta",
      atribuido_a: editorId,
      criado_por: actor.id,
      client_id: captura.client_id,
      due_date: dueDateRaw || null,
    })
    .select("id")
    .single();
  if (taskErr || !createdTask) return { error: taskErr?.message ?? "Falha ao criar tarefa" };

  // Linka a captação à task
  const { error: linkErr } = await sb
    .from("audiovisual_capturas")
    .update({ task_id: createdTask.id })
    .eq("id", capturaId);
  if (linkErr) return { error: linkErr.message };

  // Notifica o editor (já existe regra task_assigned no sistema)
  try {
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: `Nova tarefa: ${titulo}`,
      mensagem: `Captação delegada por ${actor.nome}.`,
      link: `/tarefas/${createdTask.id}`,
      user_ids_extras: [editorId],
      source_user_id: actor.id,
    });
  } catch (e) {
    console.error("[delegateCapturaAction] notif failed:", e);
  }

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: capturaId,
    acao: "update",
    dados_depois: { task_id: createdTask.id, editor_id: editorId } as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/audiovisual");
  revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  revalidatePath("/tarefas");
  return { success: true, taskId: createdTask.id };
}

/**
 * Marca a captação como concluída (manual). Status independente da
 * delegação — admin pode usar quando a captação não precisa de edit
 * ou já foi 100% finalizada.
 */
export async function markCapturaConcluidaAction(capturaId: string): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!ROLES_QUE_DELEGAM.has(actor.role)) {
    return { error: "Sem permissão" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("audiovisual_capturas")
    .update({ concluida_em: new Date().toISOString() })
    .eq("id", capturaId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: capturaId,
    acao: "complete",
    ator_id: actor.id,
  });

  revalidatePath("/audiovisual");
  revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  return { success: true };
}

/** Desmarca uma captação que estava como concluída — volta pro fluxo normal. */
export async function unmarkCapturaConcluidaAction(capturaId: string): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  if (!ROLES_QUE_DELEGAM.has(actor.role)) {
    return { error: "Sem permissão" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("audiovisual_capturas")
    .update({ concluida_em: null })
    .eq("id", capturaId);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "audiovisual_capturas",
    entidade_id: capturaId,
    acao: "reopen",
    ator_id: actor.id,
  });

  revalidatePath("/audiovisual");
  revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  return { success: true };
}
