"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  publishToInstagram,
  publishToFacebook,
  postarComentarioInicial,
  buildInstagramPostUrl,
} from "./meta-publish";

interface ActionResult {
  success?: boolean;
  error?: string;
  /** Quando publicado, retorna IDs e URLs por rede pro UI mostrar. */
  results?: {
    instagram?: { postId?: string; url?: string; error?: string };
    facebook?: { postId?: string; error?: string };
  };
}

const ROLES_QUE_PUBLICAM = ["adm", "socio", "coordenador", "assessor"];

const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/);

const publishSchema = z.object({
  id: uuidLike,
  /** Quando true, ignora agendar_para e publica agora. */
  forceNow: z.boolean().optional().default(false),
});

interface PostRow {
  id: string;
  client_id: string;
  legenda: string | null;
  primeiro_comentario: string | null;
  hashtags: string | null;
  midias: string[];
  formato: "feed" | "story" | "reels" | "carrossel";
  redes: string[];
  status: string;
  agendar_para: string | null;
  publish_attempts: number;
}

interface ClientAccounts {
  instagram_business_id: string | null;
  facebook_page_id: string | null;
  nome: string;
}

/**
 * Publica um post agora - uso manual (botão "Publicar agora" na UI) ou
 * chamado pelo cron de publicação agendada.
 *
 * Fluxo:
 * 1. Valida permissão + estado do post
 * 2. Carrega IDs das contas do cliente (FB page + IG business)
 * 3. Pra cada rede em `redes`, chama Graph API
 * 4. Grava IDs publicados (instagram_post_id, facebook_post_id)
 * 5. Status='publicado' se pelo menos uma rede deu certo, 'falha' se nenhuma
 * 6. Posta primeiro_comentario (se houver) no IG depois do publish
 */
export async function publishSocialPostAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!ROLES_QUE_PUBLICAM.includes(actor.role)) {
    return { error: "Sem permissão pra publicar" };
  }

  const parsed = publishSchema.safeParse({
    id: formData.get("id"),
    forceNow: formData.get("forceNow") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  return publishPostById(parsed.data.id, { actorId: actor.id, manual: true });
}

/** Interno - usado pelo cron + pela action. */
export async function publishPostById(
  postId: string,
  opts: { actorId: string | null; manual: boolean },
): Promise<ActionResult> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: post } = await sbAny
    .from("social_media_posts")
    .select(
      "id, client_id, legenda, primeiro_comentario, hashtags, midias, formato, redes, status, agendar_para, publish_attempts",
    )
    .eq("id", postId)
    .single();
  if (!post) return { error: "Post não encontrado" };

  const p = post as PostRow;

  if (p.status === "publicado") {
    return { error: "Post já foi publicado" };
  }
  if (p.status !== "aprovado" && p.status !== "agendado" && p.status !== "falha") {
    return { error: `Post não pode ser publicado no status atual (${p.status})` };
  }
  if (p.publish_attempts >= 5) {
    return { error: "Limite de tentativas excedido (5). Cancele e recrie o post." };
  }
  if (!p.redes || p.redes.length === 0) {
    return { error: "Nenhuma rede selecionada" };
  }

  // Carrega contas do cliente
  const { data: client } = await sbAny
    .from("clients")
    .select("nome, instagram_business_id, facebook_page_id")
    .eq("id", p.client_id)
    .single();
  if (!client) return { error: "Cliente não encontrado" };
  const c = client as ClientAccounts;

  const results: ActionResult["results"] = {};
  let qualquerSucesso = false;
  const erros: string[] = [];

  // Marca tentativa
  await sbAny
    .from("social_media_posts")
    .update({
      publish_attempts: p.publish_attempts + 1,
      last_publish_attempt_at: new Date().toISOString(),
    })
    .eq("id", p.id);

  const postPayload = {
    legenda: p.legenda ?? "",
    primeiro_comentario: p.primeiro_comentario,
    hashtags: p.hashtags,
    midias: p.midias ?? [],
    formato: p.formato,
  };

  // Instagram
  if (p.redes.includes("instagram")) {
    if (!c.instagram_business_id) {
      results.instagram = { error: "instagram_business_id não cadastrado no cliente" };
      erros.push("IG: ID da conta não cadastrado");
    } else {
      const res = await publishToInstagram(c.instagram_business_id, postPayload);
      if (res.success && res.postId) {
        results.instagram = {
          postId: res.postId,
          url: buildInstagramPostUrl(res.postId),
        };
        qualquerSucesso = true;
        await sbAny
          .from("social_media_posts")
          .update({ instagram_post_id: res.postId })
          .eq("id", p.id);
        // Primeiro comentário (opcional)
        if (p.primeiro_comentario?.trim()) {
          await postarComentarioInicial(res.postId, p.primeiro_comentario.trim());
        }
      } else {
        results.instagram = { error: res.error };
        erros.push(`IG: ${res.error}`);
      }
    }
  }

  // Facebook
  if (p.redes.includes("facebook")) {
    if (!c.facebook_page_id) {
      results.facebook = { error: "facebook_page_id não cadastrado no cliente" };
      erros.push("FB: ID da página não cadastrado");
    } else {
      const res = await publishToFacebook(c.facebook_page_id, postPayload);
      if (res.success && res.postId) {
        results.facebook = { postId: res.postId };
        qualquerSucesso = true;
        await sbAny
          .from("social_media_posts")
          .update({ facebook_post_id: res.postId })
          .eq("id", p.id);
      } else {
        results.facebook = { error: res.error };
        erros.push(`FB: ${res.error}`);
      }
    }
  }

  // Status final
  const novoStatus = qualquerSucesso ? "publicado" : "falha";
  const updatePayload: Record<string, unknown> = {
    status: novoStatus,
    publish_error: erros.length > 0 ? erros.join(" | ") : null,
  };
  if (qualquerSucesso) {
    updatePayload.publicado_em = new Date().toISOString();
  }
  await sbAny.from("social_media_posts").update(updatePayload).eq("id", p.id);

  if (opts.actorId) {
    await logAudit({
      entidade: "social_media_posts",
      entidade_id: p.id,
      acao: "update",
      dados_depois: { status: novoStatus, results } as Record<string, unknown>,
      ator_id: opts.actorId,
    });
  }

  revalidatePath("/social-media");
  revalidatePath(`/social-media/${p.client_id}`);

  if (qualquerSucesso) {
    return { success: true, results };
  }
  return { error: erros.join(" | ") || "Falha ao publicar em todas as redes", results };
}
