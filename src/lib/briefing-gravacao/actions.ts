"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { podeMarcarCheck } from "./permissions";
import { podeUploadRoteiro } from "./permissions";
import { ROTEIROS_BUCKET, validatePdfFile } from "./storage";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Result = { ok: true } | { error: string };

async function getEventoMinimo(
  eventoId: string,
): Promise<{ participantes_ids: string[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("participantes_ids")
    .eq("id", eventoId)
    .single();
  return data as { participantes_ids: string[] } | null;
}

export async function marcarLeuAction(eventoId: string): Promise<Result> {
  const user = await requireAuth();
  const evento = await getEventoMinimo(eventoId);
  if (!evento) return { error: "Evento nao encontrado" };
  if (!podeMarcarCheck({ userId: user.id, role: user.role }, evento)) {
    return { error: "Sem permissao" };
  }

  const supabase = await createClient();
  const leuPayload: Record<string, unknown> = {
    videomaker_leu_em: new Date().toISOString(),
    confirmacao_marcada_por: user.id,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("calendar_events").update(leuPayload as any).eq("id", eventoId).is("videomaker_leu_em", null);

  if (error) return { error: error.message };

  await logAudit({
    ator_id: user.id,
    entidade: "calendar_events",
    entidade_id: eventoId,
    acao: "update",
    dados_depois: {
      acao_custom: "briefing.marcou_leu",
      override: !evento.participantes_ids.includes(user.id),
    },
  });

  revalidatePath(`/calendario/${eventoId}`);
  revalidatePath("/calendario");
  return { ok: true };
}

export async function marcarImprimiuAction(eventoId: string): Promise<Result> {
  const user = await requireAuth();
  const evento = await getEventoMinimo(eventoId);
  if (!evento) return { error: "Evento nao encontrado" };
  if (!podeMarcarCheck({ userId: user.id, role: user.role }, evento)) {
    return { error: "Sem permissao" };
  }

  const supabase = await createClient();
  const imprimiuPayload: Record<string, unknown> = {
    videomaker_imprimiu_em: new Date().toISOString(),
    confirmacao_marcada_por: user.id,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("calendar_events").update(imprimiuPayload as any).eq("id", eventoId).is("videomaker_imprimiu_em", null);

  if (error) return { error: error.message };

  await logAudit({
    ator_id: user.id,
    entidade: "calendar_events",
    entidade_id: eventoId,
    acao: "update",
    dados_depois: {
      acao_custom: "briefing.marcou_imprimiu",
      override: !evento.participantes_ids.includes(user.id),
    },
  });

  revalidatePath(`/calendario/${eventoId}`);
  revalidatePath("/calendario");
  return { ok: true };
}

export async function registrarBriefingGeradoAction(
  eventoId: string,
): Promise<Result> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ briefing_gerado_em: new Date().toISOString() } as any)
    .eq("id", eventoId)
    .is("briefing_gerado_em", null);
  if (error) return { error: error.message };
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prepara o upload do PDF do roteiro DIRETO do browser pro Storage.
 *
 * O arquivo NÃO passa por Server Action: o teto de corpo do projeto é 2MB e
 * PDF de roteiro (até 10MB) estourava antes da action rodar, sem mensagem.
 * Aqui só geramos um token de upload assinado; o browser manda os bytes via
 * `uploadToSignedUrl`. Mesmo padrão dos anexos de tarefa.
 *
 * `eventoId` é null na criação (evento ainda não existe): o PDF vai pra
 * `eventos/novos/` e o path é salvo junto com o evento.
 */
export async function prepareRoteiroPdfUpload(
  eventoId: string | null,
  fileType: string,
  fileSize: number,
): Promise<{ path: string; token: string } | { error: string }> {
  const user = await requireAuth();
  if (!podeUploadRoteiro(user.role)) return { error: "Sem permissão pra anexar roteiro" };
  if (eventoId && !UUID_RE.test(eventoId)) return { error: "Evento inválido" };

  const v = validatePdfFile({ size: fileSize, type: fileType });
  if (!v.ok) return { error: v.erro ?? "Arquivo inválido" };

  const path = `eventos/${eventoId ?? "novos"}/${crypto.randomUUID()}.pdf`;
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from(ROTEIROS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? "Erro ao preparar upload" };

  if (eventoId) {
    await logAudit({
      ator_id: user.id,
      entidade: "calendar_events",
      entidade_id: eventoId,
      acao: "update",
      dados_depois: { acao_custom: "briefing.upload_pdf", path, size: fileSize },
    });
  }

  return { path: data.path ?? path, token: data.token };
}
