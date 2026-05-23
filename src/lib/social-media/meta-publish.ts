// SERVER ONLY - publica posts no Instagram e Facebook via Graph API.
//
// Setup do System User Token da BM Yide:
// - META_SYSTEM_USER_TOKEN: token gerado em business.facebook.com → Settings →
//   Users → System Users → Generate Token. Permissions necessárias:
//   pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic,
//   instagram_content_publish, business_management
// - META_GRAPH_API_VERSION: ex "v21.0"
//
// Pré-requisitos por cliente:
// - Cliente adiciona Yide BM como Partner (Settings → Partners no BM dele)
// - Cliente concede "Manage Pages" + "Manage Instagram Account" pra Yide
// - clients.facebook_page_id e clients.instagram_business_id preenchidos
//   (manualmente em /social-media/[id]/conectar)
//
// Fluxo de publicação no Instagram:
//   1. POST /{ig-user-id}/media com image_url ou video_url + caption
//      → retorna container_id
//   2. POST /{container-id}/media_publish
//      → retorna media_id (publicado)
// Carrossel: POST /{ig-user-id}/media (children=[ids]) wrapper.
//
// Fluxo no Facebook:
//   POST /{page-id}/feed com message + link/photo
//   ou POST /{page-id}/photos com url

const META_API_BASE = "https://graph.facebook.com";

function getGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION || "v21.0";
}

function getSystemUserToken(): string | null {
  return process.env.META_SYSTEM_USER_TOKEN || null;
}

export interface MetaPublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface PostToPublish {
  legenda: string;
  primeiro_comentario: string | null;
  hashtags: string | null;
  midias: string[]; // URLs públicas das mídias
  formato: "feed" | "story" | "reels" | "carrossel";
}

/** Monta a caption combinando legenda + hashtags. */
function montarCaption(post: PostToPublish): string {
  const parts: string[] = [];
  if (post.legenda?.trim()) parts.push(post.legenda.trim());
  if (post.hashtags?.trim()) parts.push(post.hashtags.trim());
  return parts.join("\n\n");
}

async function metaFetch<T = unknown>(
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<{ data?: T; error?: string }> {
  const token = getSystemUserToken();
  if (!token) {
    return { error: "META_SYSTEM_USER_TOKEN não configurado no Vercel" };
  }
  const url = `${META_API_BASE}/${getGraphVersion()}${endpoint}`;
  const params = new URLSearchParams();
  params.set("access_token", token);
  if (options.body) {
    for (const [k, v] of Object.entries(options.body)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
  }
  try {
    const res = await fetch(options.method === "POST" ? url : `${url}?${params.toString()}`, {
      method: options.method ?? "GET",
      ...(options.method === "POST"
        ? {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          }
        : {}),
      cache: "no-store",
    });
    const json = (await res.json()) as { error?: { message?: string }; [k: string]: unknown };
    if (!res.ok || json.error) {
      return { error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro de rede com Graph API" };
  }
}

/**
 * Publica no Instagram. Suporta foto única, vídeo, reels e carrossel.
 * Story (stories de 24h) usa endpoint diferente - fora do escopo da fase 1.
 */
export async function publishToInstagram(
  igUserId: string,
  post: PostToPublish,
): Promise<MetaPublishResult> {
  if (post.formato === "story") {
    return { success: false, error: "Stories ainda não suportadas (fase 2)" };
  }
  if (post.midias.length === 0) {
    return { success: false, error: "Post sem mídia - Instagram exige imagem ou vídeo" };
  }

  const caption = montarCaption(post);

  // Carrossel: cria 1 container por mídia (children), depois wrapper.
  if (post.formato === "carrossel") {
    if (post.midias.length < 2 || post.midias.length > 10) {
      return { success: false, error: "Carrossel exige 2-10 mídias" };
    }
    const childrenIds: string[] = [];
    for (const url of post.midias) {
      const isVideo = url.match(/\.(mp4|mov|m4v)(\?|$)/i);
      const childRes = await metaFetch<{ id: string }>(`/${igUserId}/media`, {
        method: "POST",
        body: isVideo
          ? { video_url: url, media_type: "VIDEO", is_carousel_item: true }
          : { image_url: url, is_carousel_item: true },
      });
      if (childRes.error || !childRes.data) {
        return { success: false, error: `Container de carrossel falhou: ${childRes.error}` };
      }
      childrenIds.push(childRes.data.id);
    }
    const wrapperRes = await metaFetch<{ id: string }>(`/${igUserId}/media`, {
      method: "POST",
      body: {
        media_type: "CAROUSEL",
        children: childrenIds.join(","),
        caption,
      },
    });
    if (wrapperRes.error || !wrapperRes.data) {
      return { success: false, error: `Wrapper de carrossel falhou: ${wrapperRes.error}` };
    }
    const publishRes = await metaFetch<{ id: string }>(`/${igUserId}/media_publish`, {
      method: "POST",
      body: { creation_id: wrapperRes.data.id },
    });
    if (publishRes.error || !publishRes.data) {
      return { success: false, error: `media_publish falhou: ${publishRes.error}` };
    }
    return { success: true, postId: publishRes.data.id };
  }

  // Foto/vídeo/reels: 1 mídia
  const url = post.midias[0];
  const isVideo = url.match(/\.(mp4|mov|m4v)(\?|$)/i);
  const mediaBody: Record<string, unknown> = isVideo
    ? {
        video_url: url,
        media_type: post.formato === "reels" ? "REELS" : "VIDEO",
        caption,
      }
    : { image_url: url, caption };

  const containerRes = await metaFetch<{ id: string }>(`/${igUserId}/media`, {
    method: "POST",
    body: mediaBody,
  });
  if (containerRes.error || !containerRes.data) {
    return { success: false, error: `Criar container falhou: ${containerRes.error}` };
  }

  // Pra vídeos/reels, container fica processando - aguarda status FINISHED.
  if (isVideo) {
    const containerId = containerRes.data.id;
    for (let i = 0; i < 30; i++) {
      const statusRes = await metaFetch<{ status_code: string }>(`/${containerId}`, {
        body: { fields: "status_code" },
      });
      if (statusRes.data?.status_code === "FINISHED") break;
      if (statusRes.data?.status_code === "ERROR") {
        return { success: false, error: "Vídeo falhou no processamento Meta" };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const publishRes = await metaFetch<{ id: string }>(`/${igUserId}/media_publish`, {
    method: "POST",
    body: { creation_id: containerRes.data.id },
  });
  if (publishRes.error || !publishRes.data) {
    return { success: false, error: `media_publish falhou: ${publishRes.error}` };
  }
  return { success: true, postId: publishRes.data.id };
}

/**
 * Publica no Facebook Page. Posts simples (texto + foto).
 * Vídeo no Facebook usa endpoint diferente - fora do escopo da fase 1.
 */
export async function publishToFacebook(
  pageId: string,
  post: PostToPublish,
): Promise<MetaPublishResult> {
  const message = montarCaption(post);

  // Sem mídia: post só de texto
  if (post.midias.length === 0) {
    const res = await metaFetch<{ id: string }>(`/${pageId}/feed`, {
      method: "POST",
      body: { message },
    });
    if (res.error || !res.data) return { success: false, error: res.error };
    return { success: true, postId: res.data.id };
  }

  // Foto única
  if (post.midias.length === 1) {
    const url = post.midias[0];
    const isVideo = url.match(/\.(mp4|mov|m4v)(\?|$)/i);
    if (isVideo) {
      return { success: false, error: "Vídeo no Facebook ainda não suportado (fase 2)" };
    }
    const res = await metaFetch<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
      method: "POST",
      body: { url, caption: message },
    });
    if (res.error || !res.data) return { success: false, error: res.error };
    return { success: true, postId: res.data.post_id ?? res.data.id };
  }

  // Múltiplas: posta como link/álbum (simplificado: posta 1 por enquanto)
  return {
    success: false,
    error: "Álbum/carrossel no Facebook ainda não suportado (use Instagram pra carrossel)",
  };
}

/**
 * Posta primeiro comentário em um post recém publicado no Instagram.
 * Útil pra hashtags ou observações que não fazem sentido na caption.
 */
export async function postarComentarioInicial(
  postId: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await metaFetch<{ id: string }>(`/${postId}/comments`, {
    method: "POST",
    body: { message },
  });
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}

/**
 * Helper: monta URL do post Instagram a partir do post_id.
 * Pra Facebook, o page_id_post_id já é navegável via permalink.
 */
export function buildInstagramPostUrl(postId: string): string {
  // postId formato: 17841401234567890_18012345678901234
  // Permalink via API: GET /{post-id}?fields=permalink. Aqui só monta um link genérico.
  return `https://www.instagram.com/p/${postId}/`;
}
