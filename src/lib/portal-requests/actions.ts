"use server";

import { revalidatePath } from "next/cache";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { createRequestSchema, respondRequestSchema, changeStatusSchema } from "./schema";

type ActionResult = { success?: boolean; error?: string; id?: string };

const ROLES_INTERNO = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];

function fd(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === "") return undefined;
  return String(v);
}

/**
 * Portal cliente abre uma nova solicitação. Cria com status='aberta' e
 * notifica assessor/coordenador do cliente.
 */
export async function createPortalRequestAction(formData: FormData): Promise<ActionResult> {
  const user = await requireClientPortalAuth();

  const parsed = createRequestSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    categoria: fd(formData, "categoria"),
    prioridade: fd(formData, "prioridade") ?? "normal",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const insertPayload = {
    client_id: user.clientId,
    created_by_user_id: user.userId,
    created_by_nome: user.nomeContato,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao,
    categoria: parsed.data.categoria,
    prioridade: parsed.data.prioridade,
    status: "aberta",
  };
  const { data: created, error } = await sbAny
    .from("client_portal_requests")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar solicitação" };

  // Notifica assessor + coordenador do cliente
  try {
    const { data: cliente } = await sbAny
      .from("clients")
      .select("nome, assessor_id, coordenador_id")
      .eq("id", user.clientId)
      .maybeSingle();
    if (cliente) {
      const recipients = [cliente.assessor_id, cliente.coordenador_id]
        .filter((id: string | null): id is string => !!id);
      if (recipients.length > 0) {
        await dispatchNotification({
          evento_tipo: "task_assigned",
          titulo: "Nova solicitação no portal",
          mensagem: `${user.nomeContato ?? "Cliente"} (${cliente.nome}) abriu: ${parsed.data.titulo}`,
          link: `/solicitacoes/${created.id}`,
          user_ids_extras: recipients,
          // source_user_id omitido — cliente portal não é colab; notificação
          // entra como "sistema".
        });
      }
    }
  } catch (e) {
    console.error("[portal-requests] notification failed:", e);
  }

  await logAudit({
    entidade: "client_portal_requests",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload as unknown as Record<string, unknown>,
    ator_id: null, // portal user, não colab
  });

  revalidatePath("/cliente");
  revalidatePath("/solicitacoes");
  return { success: true, id: created.id };
}

/**
 * Portal cliente cancela a própria solicitação (só se ainda tá 'aberta').
 */
export async function cancelPortalRequestAction(id: string): Promise<ActionResult> {
  const user = await requireClientPortalAuth();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: existing } = await sbAny
    .from("client_portal_requests")
    .select("id, status, created_by_user_id, client_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "Solicitação não encontrada" };
  if (existing.created_by_user_id !== user.userId) return { error: "Sem permissão" };
  if (existing.status !== "aberta") {
    return { error: "Só dá pra cancelar enquanto está aberta" };
  }

  const { error } = await sbAny
    .from("client_portal_requests")
    .update({ status: "cancelada" })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_portal_requests",
    entidade_id: id,
    acao: "update",
    dados_depois: { status: "cancelada" },
    ator_id: null,
  });

  revalidatePath("/cliente");
  revalidatePath("/solicitacoes");
  return { success: true };
}

/**
 * Equipe interna responde + muda status. Resposta é uma única (MVP).
 * to_status: 'em_andamento' (resposta parcial) ou 'concluida' (resolvida).
 */
export async function respondPortalRequestAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_INTERNO.includes(actor.role)) return { error: "Sem permissão" };

  const parsed = respondRequestSchema.safeParse({
    id: fd(formData, "id"),
    resposta: fd(formData, "resposta"),
    to_status: fd(formData, "to_status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const updatePayload: Record<string, unknown> = {
    resposta: parsed.data.resposta,
    status: parsed.data.to_status,
    resolvido_por: actor.id,
  };
  if (parsed.data.to_status === "concluida") {
    updatePayload.resolvido_em = new Date().toISOString();
  }

  const { error } = await sbAny
    .from("client_portal_requests")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_portal_requests",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: updatePayload as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${parsed.data.id}`);
  revalidatePath("/cliente");
  return { success: true };
}

/**
 * Mudança rápida de status (sem texto de resposta). Usada por adm/sócio
 * pra reabrir ou cancelar uma solicitação por exemplo.
 */
export async function changePortalRequestStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_INTERNO.includes(actor.role)) return { error: "Sem permissão" };

  const parsed = changeStatusSchema.safeParse({
    id: fd(formData, "id"),
    status: fd(formData, "status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const updatePayload: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "concluida") {
    updatePayload.resolvido_em = new Date().toISOString();
    updatePayload.resolvido_por = actor.id;
  }

  const { error } = await sbAny
    .from("client_portal_requests")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "client_portal_requests",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: updatePayload as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${parsed.data.id}`);
  revalidatePath("/cliente");
  return { success: true };
}
