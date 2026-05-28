"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { podeMarcarCheck } from "./permissions";
import { podeUploadRoteiro } from "./permissions";
import { uploadRoteiroPdf } from "./storage";

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

export async function uploadRoteiroPdfAction(
  eventoId: string,
  formData: FormData,
): Promise<{ path: string } | { error: string }> {
  const user = await requireAuth();
  if (!podeUploadRoteiro(user.role)) return { error: "Sem permissao" };

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Arquivo invalido" };

  const buffer = await file.arrayBuffer();
  const result = await uploadRoteiroPdf({
    eventoId,
    file: buffer,
    contentType: file.type,
  });
  if ("erro" in result) return { error: result.erro };

  await logAudit({
    ator_id: user.id,
    entidade: "calendar_events",
    entidade_id: eventoId,
    acao: "update",
    dados_depois: {
      acao_custom: "briefing.upload_pdf",
      path: result.path,
      size: file.size,
    },
  });

  return { path: result.path };
}
