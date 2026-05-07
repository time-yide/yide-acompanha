"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { isoWeek } from "@/lib/satisfacao/iso-week";
import { createCapturaSchema } from "./schema";
import { avgRating } from "./queries";

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

  if (!parsed.success) return { error: parsed.error.issues[0].message };

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
  revalidatePath("/satisfacao");
  redirect("/audiovisual?toast=entregue");
}
