"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
] as const;

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Token inválido",
);

// =============================================================================
// Action interna: enviar arte pra aprovação (autenticada)
// =============================================================================

const sendForApprovalSchema = z.object({
  id: uuidLike,
});

export async function sendArteForApprovalAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!(ROLES_QUE_GERENCIAM as readonly string[]).includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const parsed = sendForApprovalSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega arte + valida que tem mídia
  const { data: arteData } = await sb
    .from("design_artes")
    .select("id, client_id, midias, status")
    .eq("id", parsed.data.id)
    .single();
  if (!arteData) return { error: "Arte não encontrada" };

  const arte = arteData as { id: string; client_id: string; midias: unknown; status: string };
  if (!Array.isArray(arte.midias) || arte.midias.length === 0) {
    return { error: "A arte precisa ter ao menos uma mídia" };
  }

  // Muda status pra aguardando_aprovacao
  const { error } = await sb
    .from("design_artes")
    .update({ status: "aguardando_aprovacao", ajuste_observacoes: null })
    .eq("id", arte.id);
  if (error) return { error: error.message };

  revalidatePath("/design");
  revalidatePath(`/design/${arte.client_id}`);
  return { success: true };
}

// =============================================================================
// Action pública: cliente responde (sem auth, com rate limit por token)
// =============================================================================

const respondSchema = z.object({
  token: uuidLike,
  acao: z.enum(["aprovar", "ajuste"]),
  email: z.string().email("Email inválido").max(200).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

interface RespondResult {
  success?: true;
  error?: string;
  status?: string;
}

export async function respondToDesignApprovalAction(
  formData: FormData,
): Promise<RespondResult> {
  const parsed = respondSchema.safeParse({
    token: formData.get("token"),
    acao: formData.get("acao"),
    email: formData.get("email") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.acao === "ajuste") {
    if (!parsed.data.observacoes || parsed.data.observacoes.length < 3) {
      return { error: "Descreva o ajuste (mín. 3 caracteres)" };
    }
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Rate limit basico via auth_rate_limit (chave: design-approval:<token>)
  // Bloqueia mais de 10 tentativas em 5 minutos por token.
  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `design-approval:${parsed.data.token}:${ip}`;
  const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: rateData } = await sb
    .from("auth_rate_limit")
    .select("attempts, blocked_until")
    .eq("key", rateKey)
    .single();
  if (rateData) {
    const r = rateData as { attempts: number; blocked_until: string | null };
    if (r.blocked_until && new Date(r.blocked_until) > new Date()) {
      return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
    }
    if (r.attempts >= 10) {
      const blockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await sb
        .from("auth_rate_limit")
        .update({ blocked_until: blockedUntil })
        .eq("key", rateKey);
      return { error: "Limite de tentativas atingido." };
    }
    await sb
      .from("auth_rate_limit")
      .update({ attempts: r.attempts + 1 })
      .eq("key", rateKey);
  } else {
    await sb.from("auth_rate_limit").insert({
      key: rateKey,
      attempts: 1,
      window_start: windowStart,
    });
  }

  // Busca arte pelo token
  const { data: arteData } = await sb
    .from("design_artes")
    .select("id, client_id, titulo, status, criado_por, archived_at")
    .eq("aprovacao_token", parsed.data.token)
    .single();

  if (!arteData) return { error: "Link inválido ou expirado" };
  const arte = arteData as {
    id: string;
    client_id: string;
    titulo: string;
    status: string;
    criado_por: string | null;
    archived_at: string | null;
  };

  if (arte.archived_at) {
    return { error: "Esta arte foi arquivada" };
  }

  if (arte.status === "aprovado" || arte.status === "agendado" || arte.status === "publicado") {
    return { success: true, status: "ja_aprovado", error: "Esta arte já foi aprovada anteriormente." };
  }

  if (arte.status === "ajustes_solicitados" && parsed.data.acao === "ajuste") {
    return { success: true, status: arte.status, error: "Ajustes já foram registrados anteriormente." };
  }

  // Atualiza status da arte
  const updatePayload: Record<string, unknown> = parsed.data.acao === "aprovar"
    ? {
        status: "aprovado",
        aprovado_em: new Date().toISOString(),
        aprovado_por_email: parsed.data.email ?? null,
        ajuste_observacoes: null,
      }
    : {
        status: "ajustes_solicitados",
        ajuste_observacoes: parsed.data.observacoes ?? null,
        aprovado_por_email: parsed.data.email ?? null,
      };

  const { error: updErr } = await sb
    .from("design_artes")
    .update(updatePayload)
    .eq("id", arte.id);
  if (updErr) return { error: updErr.message };

  // Notifica o criador da arte
  if (arte.criado_por) {
    try {
      await sb.from("notifications").insert({
        user_id: arte.criado_por,
        tipo: parsed.data.acao === "aprovar" ? "design_aprovado" : "design_ajustes_solicitados",
        titulo: parsed.data.acao === "aprovar"
          ? `Cliente aprovou: "${arte.titulo}"`
          : `Cliente pediu ajustes: "${arte.titulo}"`,
        mensagem: parsed.data.acao === "aprovar"
          ? `Aprovado${parsed.data.email ? ` por ${parsed.data.email}` : ""}.`
          : (parsed.data.observacoes ?? "Cliente pediu ajustes."),
        link: `/design/${arte.client_id}`,
      });
    } catch (err) {
      // Não bloqueia a aprovação se notificação falhar
      console.error("[design-aprovacao] notification insert failed:", err);
    }
  }

  revalidatePath("/design");
  revalidatePath(`/design/${arte.client_id}`);
  return {
    success: true,
    status: parsed.data.acao === "aprovar" ? "aprovado" : "ajustes_solicitados",
  };
}
