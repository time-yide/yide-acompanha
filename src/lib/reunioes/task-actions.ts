"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { MEETINGS_CACHE_TAG } from "./queries";

const aceitarSchema = z.object({
  extracted_task_id: z.string().uuid(),
  /** Override do atribuido_a se o user quiser mudar. Se null, usa o que IA sugeriu. */
  atribuido_a_override: z.string().uuid().nullable().optional(),
});

/**
 * Aceita uma task sugerida pela IA: cria registro real em `public.tasks` e
 * marca extracted_task como aceita com a referência.
 *
 * Fallback de atribuição: se IA sugeriu mas user override veio null, e
 * sugestão também é null, atribui ao próprio user (criador).
 */
export async function aceitarTaskSugeridaAction(input: {
  extracted_task_id: string;
  atribuido_a_override?: string | null;
}): Promise<{ task_id: string } | { error: string }> {
  const user = await requireAuth();
  const parsed = aceitarSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: extracted } = await sb
    .from("meeting_extracted_tasks")
    .select(`
      id, titulo_sugerido, descricao_sugerida, atribuido_a_sugestao,
      due_date_sugestao, estado, meeting_id, task_id,
      meeting:meetings!meeting_extracted_tasks_meeting_id_fkey(client_id)
    `)
    .eq("id", parsed.data.extracted_task_id)
    .maybeSingle();

  if (!extracted) return { error: "Sugestão de tarefa não encontrada" };
  if ((extracted as { estado: string }).estado === "aceita" && (extracted as { task_id: string | null }).task_id) {
    return { task_id: (extracted as { task_id: string }).task_id };
  }

  const row = extracted as {
    id: string;
    titulo_sugerido: string;
    descricao_sugerida: string | null;
    atribuido_a_sugestao: string | null;
    due_date_sugestao: string | null;
    meeting_id: string;
    meeting: { client_id: string | null } | null;
  };

  const atribuidoA =
    parsed.data.atribuido_a_override ?? row.atribuido_a_sugestao ?? user.id;

  // Cria task real em public.tasks
  const { data: createdTask, error: taskError } = await sb
    .from("tasks")
    .insert({
      titulo: row.titulo_sugerido,
      descricao: row.descricao_sugerida,
      criado_por: user.id,
      atribuido_a: atribuidoA,
      due_date: row.due_date_sugestao,
      client_id: row.meeting?.client_id ?? null,
      prioridade: "media" as const,
      status: "aberta" as const,
    })
    .select("id")
    .single();

  if (taskError || !createdTask) {
    return { error: taskError?.message ?? "Falha ao criar tarefa" };
  }

  // Marca extracted_task como aceita
  const { error: updateError } = await sb
    .from("meeting_extracted_tasks")
    .update({
      task_id: createdTask.id,
      estado: "aceita" as const,
    })
    .eq("id", row.id);

  if (updateError) {
    // Best-effort: task foi criada mas o link falhou. Não dá rollback.
    console.error("[aceitarTaskSugerida] falha ao linkar extracted_task:", updateError);
  }

  await logAudit({
    entidade: "meeting_extracted_tasks",
    entidade_id: row.id,
    acao: "update",
    dados_depois: { estado: "aceita", task_id: createdTask.id },
    ator_id: user.id,
  });

  revalidatePath(`/reunioes/${row.meeting_id}`);
  revalidatePath("/tarefas");
  revalidateTag(MEETINGS_CACHE_TAG, "default");
  return { task_id: createdTask.id };
}

const descartarSchema = z.object({
  extracted_task_id: z.string().uuid(),
});

export async function descartarTaskSugeridaAction(input: {
  extracted_task_id: string;
}): Promise<{ success: true } | { error: string }> {
  const user = await requireAuth();
  const parsed = descartarSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: extracted } = await sb
    .from("meeting_extracted_tasks")
    .select("id, meeting_id, estado")
    .eq("id", parsed.data.extracted_task_id)
    .maybeSingle();
  if (!extracted) return { error: "Sugestão não encontrada" };

  const { error } = await sb
    .from("meeting_extracted_tasks")
    .update({ estado: "descartada" as const })
    .eq("id", parsed.data.extracted_task_id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "meeting_extracted_tasks",
    entidade_id: parsed.data.extracted_task_id,
    acao: "update",
    dados_depois: { estado: "descartada" },
    ator_id: user.id,
  });

  revalidatePath(`/reunioes/${(extracted as { meeting_id: string }).meeting_id}`);
  revalidateTag(MEETINGS_CACHE_TAG, "default");
  return { success: true };
}
