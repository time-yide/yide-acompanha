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
// Action interna: enviar post pra aprovação (autenticada)
// =============================================================================

const sendForApprovalSchema = z.object({
  id: uuidLike,
});

export async function sendPostForApprovalAction(formData: FormData): Promise<ActionResult> {
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

  const { data: postData } = await sb
    .from("social_media_posts")
    .select("id, client_id, midias, redes, status")
    .eq("id", parsed.data.id)
    .single();
  if (!postData) return { error: "Post não encontrado" };

  const post = postData as {
    id: string;
    client_id: string;
    midias: unknown;
    redes: unknown;
    status: string;
  };

  if (!Array.isArray(post.midias) || post.midias.length === 0) {
    return { error: "O post precisa ter ao menos uma mídia" };
  }
  if (!Array.isArray(post.redes) || post.redes.length === 0) {
    return { error: "Selecione ao menos uma rede pra publicar" };
  }

  const { error } = await sb
    .from("social_media_posts")
    .update({ status: "aguardando_aprovacao", ajuste_observacoes: null })
    .eq("id", post.id);
  if (error) return { error: error.message };

  revalidatePath("/social-media");
  revalidatePath(`/social-media/${post.client_id}`);
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

export async function respondToSocialApprovalAction(
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

  // Rate limit por IP+token (10 tentativas em 5min, depois bloqueia 10min)
  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `social-approval:${parsed.data.token}:${ip}`;
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

  const { data: postData } = await sb
    .from("social_media_posts")
    .select("id, client_id, titulo, legenda, status, criado_por, archived_at")
    .eq("aprovacao_token", parsed.data.token)
    .single();
  if (!postData) return { error: "Link inválido ou expirado" };

  const post = postData as {
    id: string;
    client_id: string;
    titulo: string | null;
    legenda: string | null;
    status: string;
    criado_por: string | null;
    archived_at: string | null;
  };

  if (post.archived_at) return { error: "Este post foi arquivado" };

  if (
    post.status === "aprovado" ||
    post.status === "agendado" ||
    post.status === "publicado"
  ) {
    return {
      success: true,
      status: "ja_aprovado",
      error: "Este post já foi aprovado anteriormente.",
    };
  }

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
    .from("social_media_posts")
    .update(updatePayload)
    .eq("id", post.id);
  if (updErr) return { error: updErr.message };

  // Notifica criador
  if (post.criado_por) {
    try {
      const tituloPost = post.titulo ?? post.legenda?.slice(0, 50) ?? "post";
      await sb.from("notifications").insert({
        user_id: post.criado_por,
        tipo: parsed.data.acao === "aprovar" ? "social_post_aprovado" : "social_post_ajustes_solicitados",
        titulo: parsed.data.acao === "aprovar"
          ? `Cliente aprovou o post: "${tituloPost}"`
          : `Cliente pediu ajustes no post: "${tituloPost}"`,
        mensagem: parsed.data.acao === "aprovar"
          ? `Aprovado${parsed.data.email ? ` por ${parsed.data.email}` : ""}.`
          : (parsed.data.observacoes ?? "Cliente pediu ajustes."),
        link: `/social-media/${post.client_id}`,
      });
    } catch (err) {
      console.error("[social-aprovacao] notification insert failed:", err);
    }
  }

  revalidatePath("/social-media");
  revalidatePath(`/social-media/${post.client_id}`);
  return {
    success: true,
    status: parsed.data.acao === "aprovar" ? "aprovado" : "ajustes_solicitados",
  };
}
