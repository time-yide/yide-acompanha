"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { getCoordenadoresAudiovisualIds } from "@/lib/tarefas/client-team";
import { logAudit } from "@/lib/audit/log";
import { createBloqueioSchema, rejeitarBloqueioSchema } from "./schema";
import { BLOQUEIOS_TAG } from "./queries";

type Result = { error?: string; success?: boolean };

const ROLES_APROVAM = ["audiovisual_chefe", "adm", "socio"];

function fmtHora(t: string) { return t.slice(0, 5); }
function fmtDataBR(d: string) { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }

function revalidar() {
  revalidatePath("/audiovisual");
  revalidateTag(BLOQUEIOS_TAG, "default");
}

export async function solicitarBloqueioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const parsed = createBloqueioSchema.safeParse({
    data: formData.get("data"),
    hora_inicio: formData.get("hora_inicio"),
    hora_fim: formData.get("hora_fim"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", actor.id).single();
  if (!prof) return { error: "Perfil não encontrado" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: inserted, error } = await sb
    .from("agenda_bloqueios")
    .insert({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      organization_id: (prof as any).organization_id,
      criado_por: actor.id,
      criado_por_nome: actor.nome,
      data: parsed.data.data,
      hora_inicio: parsed.data.hora_inicio,
      hora_fim: parsed.data.hora_fim,
      motivo: parsed.data.motivo,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    entidade: "agenda_bloqueios",
    entidade_id: inserted?.id ?? "",
    acao: "create",
    ator_id: actor.id,
    dados_depois: parsed.data as unknown as Record<string, unknown>,
  });

  const coordIds = await getCoordenadoresAudiovisualIds();
  await dispatchNotification({
    evento_tipo: "bloqueio_agenda_solicitado",
    titulo: "Nova solicitação de bloqueio de agenda",
    mensagem: `${actor.nome} solicitou bloqueio em ${fmtDataBR(parsed.data.data)} das ${parsed.data.hora_inicio} às ${parsed.data.hora_fim}. Motivo: ${parsed.data.motivo}`,
    link: "/audiovisual",
    user_ids_extras: coordIds,
    source_user_id: actor.id,
  });

  revalidar();
  return { success: true };
}

async function responder(
  actor: { id: string; role: string; nome: string },
  id: string,
  novoStatus: "aprovada" | "rejeitada",
  motivoRecusa?: string,
): Promise<Result> {
  if (!ROLES_APROVAM.includes(actor.role)) {
    return { error: "Apenas coordenador audiovisual, adm ou sócio podem responder" };
  }
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const patch = {
    status: novoStatus,
    respondido_por: actor.id,
    respondido_em: new Date().toISOString(),
    motivo_recusa: novoStatus === "rejeitada" ? (motivoRecusa ?? null) : null,
  };

  const { error } = await sb.from("agenda_bloqueios").update(patch).eq("id", id).eq("status", "pendente");
  if (error) return { error: error.message };

  const { data: row } = await sb
    .from("agenda_bloqueios")
    .select("id, criado_por, status, data, hora_inicio, hora_fim")
    .eq("id", id)
    .single();
  if (!row || row.status !== novoStatus) {
    return { error: "Não foi possível responder (já respondido ou sem permissão)" };
  }

  await logAudit({
    entidade: "agenda_bloqueios",
    entidade_id: id,
    acao: "update",
    ator_id: actor.id,
    dados_depois: { status: novoStatus, motivo_recusa: patch.motivo_recusa },
  });

  const msg =
    novoStatus === "aprovada"
      ? `Seu bloqueio de ${fmtDataBR(row.data)} das ${fmtHora(row.hora_inicio)} às ${fmtHora(row.hora_fim)} foi aprovado.`
      : `Seu bloqueio de ${fmtDataBR(row.data)} das ${fmtHora(row.hora_inicio)} às ${fmtHora(row.hora_fim)} foi recusado. Motivo: ${motivoRecusa}`;

  await dispatchNotification({
    evento_tipo: "bloqueio_agenda_respondido",
    titulo: novoStatus === "aprovada" ? "Bloqueio aprovado" : "Bloqueio recusado",
    mensagem: msg,
    link: "/audiovisual",
    user_ids_extras: [row.criado_por],
    source_user_id: actor.id,
  });

  revalidar();
  return { success: true };
}

export async function aprovarBloqueioAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  return responder(actor, id, "aprovada");
}

export async function rejeitarBloqueioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const parsed = rejeitarBloqueioSchema.safeParse({
    id: formData.get("id"),
    motivo_recusa: formData.get("motivo_recusa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return responder(actor, parsed.data.id, "rejeitada", parsed.data.motivo_recusa);
}

export async function cancelarBloqueioAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("agenda_bloqueios")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", id)
    .eq("criado_por", actor.id)
    .eq("status", "pendente");
  if (error) return { error: error.message };
  revalidar();
  return { success: true };
}
