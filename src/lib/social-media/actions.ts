"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logActivityInternal } from "@/lib/produtividade/actions";
import { listAvailableAccounts, type MetaAccount } from "./meta-publish";
import { STATUS_VALORES } from "./tipos";
import { gerarLegenda, type CaptionResult } from "./caption-generator";
import { sincronizarMetricasPost } from "./insights-sync";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;
type CreateResult = (ActionOk & { id: string }) | ActionErr;
type UploadResult = { url: string } | ActionErr;

const ROLES_QUE_GERENCIAM = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
] as const;

function canManage(role: string): boolean {
  return (ROLES_QUE_GERENCIAM as readonly string[]).includes(role);
}

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

function fd(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function parseStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

const REDES_VALIDAS = ["instagram", "facebook", "linkedin", "gmn"] as const;
const FORMATOS_VALIDOS = ["feed", "carrossel", "story", "reels"] as const;

const createPostSchema = z.object({
  client_id: uuidLike,
  titulo: z.string().trim().max(200).optional().nullable(),
  legenda: z.string().trim().max(4000).optional().nullable(),
  primeiro_comentario: z.string().trim().max(2000).optional().nullable(),
  hashtags: z.string().trim().max(2000).optional().nullable(),
  formato: z.enum(FORMATOS_VALIDOS).default("feed"),
  redes: z.array(z.enum(REDES_VALIDAS)).max(4).default([]),
  midias: z.array(z.string().url()).max(20).default([]),
  agendar_para: z.string().nullable().optional(),
  status: z.enum(STATUS_VALORES).default("rascunho"),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export async function createSocialPostAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = createPostSchema.safeParse({
    client_id: fd(formData, "client_id"),
    titulo: fd(formData, "titulo"),
    legenda: fd(formData, "legenda"),
    primeiro_comentario: fd(formData, "primeiro_comentario"),
    hashtags: fd(formData, "hashtags"),
    formato: fd(formData, "formato") ?? "feed",
    redes: parseStringArray(formData.get("redes")) as ("instagram" | "facebook" | "linkedin" | "gmn")[],
    midias: parseStringArray(formData.get("midias")),
    agendar_para: fd(formData, "agendar_para"),
    status: fd(formData, "status") ?? "rascunho",
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", parsed.data.client_id)
    .single();
  if (!client) return { error: "Cliente não encontrado" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.from("social_media_posts").insert({
    organization_id: (client as { organization_id: string }).organization_id,
    client_id: parsed.data.client_id,
    titulo: parsed.data.titulo,
    legenda: parsed.data.legenda,
    primeiro_comentario: parsed.data.primeiro_comentario,
    hashtags: parsed.data.hashtags,
    formato: parsed.data.formato,
    redes: parsed.data.redes,
    midias: parsed.data.midias,
    agendar_para: parsed.data.agendar_para,
    status: parsed.data.status,
    observacoes: parsed.data.observacoes,
    criado_por: actor.id,
  }).select("id").single();
  if (error) return { error: error.message };

  const postId = (data as { id: string }).id;
  await logActivityInternal(actor.id, "post_criado", {
    entityType: "social_media_posts",
    entityId: postId,
    clientId: parsed.data.client_id,
    metadata: { titulo: parsed.data.titulo, formato: parsed.data.formato },
  });

  revalidatePath("/social-media");
  revalidatePath(`/social-media/${parsed.data.client_id}`);
  return { success: true, id: postId };
}

const updatePostSchema = createPostSchema.extend({
  id: uuidLike,
});

export async function updateSocialPostAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = updatePostSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    titulo: fd(formData, "titulo"),
    legenda: fd(formData, "legenda"),
    primeiro_comentario: fd(formData, "primeiro_comentario"),
    hashtags: fd(formData, "hashtags"),
    formato: fd(formData, "formato") ?? "feed",
    redes: parseStringArray(formData.get("redes")) as ("instagram" | "facebook" | "linkedin" | "gmn")[],
    midias: parseStringArray(formData.get("midias")),
    agendar_para: fd(formData, "agendar_para"),
    status: fd(formData, "status") ?? "rascunho",
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("social_media_posts")
    .update({
      titulo: parsed.data.titulo,
      legenda: parsed.data.legenda,
      primeiro_comentario: parsed.data.primeiro_comentario,
      hashtags: parsed.data.hashtags,
      formato: parsed.data.formato,
      redes: parsed.data.redes,
      midias: parsed.data.midias,
      agendar_para: parsed.data.agendar_para,
      status: parsed.data.status,
      observacoes: parsed.data.observacoes,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/social-media");
  revalidatePath(`/social-media/${parsed.data.client_id}`);
  return { success: true };
}

const archiveSchema = z.object({ id: uuidLike });

export async function archiveSocialPostAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = archiveSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("social_media_posts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/social-media");
  return { success: true };
}

const changeStatusSchema = z.object({
  id: uuidLike,
  status: z.enum(STATUS_VALORES),
});

export async function changeSocialPostStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = changeStatusSchema.safeParse({
    id: fd(formData, "id"),
    status: fd(formData, "status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const updatePayload: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "aprovado") {
    updatePayload.aprovado_em = new Date().toISOString();
  }
  const { error } = await sb
    .from("social_media_posts")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  if (parsed.data.status === "aprovado") {
    await logActivityInternal(actor.id, "post_aprovado", {
      entityType: "social_media_posts",
      entityId: parsed.data.id,
    });
  }

  revalidatePath("/social-media");
  return { success: true };
}

// ===========================================================================
// Mapping cliente → contas de rede social (pré-requisito Fase 2)
// ===========================================================================

const updateClienteSocialAccountsSchema = z.object({
  client_id: uuidLike,
  instagram_business_id: z.string().trim().max(80).optional().nullable(),
  facebook_page_id: z.string().trim().max(80).optional().nullable(),
  linkedin_company_id: z.string().trim().max(80).optional().nullable(),
  gmn_location_id: z.string().trim().max(80).optional().nullable(),
});

export async function updateClienteSocialAccountsAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = updateClienteSocialAccountsSchema.safeParse({
    client_id: fd(formData, "client_id"),
    instagram_business_id: fd(formData, "instagram_business_id"),
    facebook_page_id: fd(formData, "facebook_page_id"),
    linkedin_company_id: fd(formData, "linkedin_company_id"),
    gmn_location_id: fd(formData, "gmn_location_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("clients")
    .update({
      instagram_business_id: parsed.data.instagram_business_id,
      facebook_page_id: parsed.data.facebook_page_id,
      linkedin_company_id: parsed.data.linkedin_company_id,
      gmn_location_id: parsed.data.gmn_location_id,
    })
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  revalidatePath(`/social-media/${parsed.data.client_id}`);
  return { success: true };
}

/**
 * Lista as contas (Páginas FB + Instagram vinculado) que o System User token
 * consegue acessar, pra UI conectar o cliente escolhendo numa lista — sem
 * precisar copiar/colar IDs na mão (estilo mLabs).
 */
export async function listMetaAccountsAction(): Promise<
  { accounts: MetaAccount[] } | ActionErr
> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const res = await listAvailableAccounts();
  if (res.error) return { error: res.error };
  return { accounts: res.accounts ?? [] };
}

// ===========================================================================
// Upload de mídia
// ===========================================================================

const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime",
];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB (Reels permite vídeos maiores)

export async function uploadSocialMidiaAction(
  clientId: string,
  formData: FormData,
): Promise<UploadResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: `Tipo não suportado: ${file.type}` };
  }
  if (file.size > MAX_BYTES) {
    return { error: `Arquivo grande demais (max ${MAX_BYTES / 1024 / 1024}MB)` };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: client } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .single();
  if (!client) return { error: "Cliente não encontrado" };
  const orgId = (client as { organization_id: string }).organization_id;

  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const path = `${orgId}/${clientId}/${filename}`;

  const { error: uploadErr } = await sb.storage
    .from("social-media-creatives")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  const { data: signed } = await sb.storage
    .from("social-media-creatives")
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL" };

  return { url: signed.signedUrl };
}

// ===========================================================================
// IA: gerar/melhorar legenda + hashtags (opt-in, só roda no clique)
// ===========================================================================

const gerarLegendaSchema = z.object({
  client_id: uuidLike,
  brief: z.string().trim().max(500).optional().nullable(),
  rascunho: z.string().trim().max(4000).optional().nullable(),
  formato: z.enum(FORMATOS_VALIDOS).default("feed"),
  redes: z.array(z.enum(REDES_VALIDAS)).max(4).default([]),
});

export async function gerarLegendaIaAction(input: {
  client_id: string;
  brief?: string | null;
  rascunho?: string | null;
  formato?: string;
  redes?: string[];
}): Promise<CaptionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = gerarLegendaSchema.safeParse({
    client_id: input.client_id,
    brief: input.brief ?? null,
    rascunho: input.rascunho ?? null,
    formato: input.formato ?? "feed",
    redes: (input.redes ?? []) as ("instagram" | "facebook" | "linkedin" | "gmn")[],
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Busca contexto da marca. design_style_guide pode não existir no schema cache → fallback.
  let nome = "Cliente";
  let servico: string | null = null;
  let sg: Record<string, unknown> = {};

  const full = await sb
    .from("clients")
    .select("nome, servico_contratado, design_style_guide")
    .eq("id", parsed.data.client_id)
    .single();
  if (full.error) {
    const msg = full.error.message ?? "";
    if (msg.includes("design_style_guide") || msg.includes("schema cache")) {
      const basic = await sb
        .from("clients")
        .select("nome, servico_contratado")
        .eq("id", parsed.data.client_id)
        .single();
      if (!basic.data) return { error: "Cliente não encontrado" };
      nome = basic.data.nome ?? "Cliente";
      servico = basic.data.servico_contratado ?? null;
    } else {
      return { error: "Cliente não encontrado" };
    }
  } else if (full.data) {
    nome = full.data.nome ?? "Cliente";
    servico = full.data.servico_contratado ?? null;
    sg = (full.data.design_style_guide ?? {}) as Record<string, unknown>;
  }

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  return gerarLegenda({
    clientNome: nome,
    servico,
    tomVoz: str(sg.tom_voz),
    mood: str(sg.mood),
    evitar: str(sg.evitar),
    formato: parsed.data.formato,
    redes: parsed.data.redes,
    brief: parsed.data.brief ?? null,
    rascunho: parsed.data.rascunho ?? null,
  });
}

// ===========================================================================
// Atualizar métricas de um post sob demanda (botão na UI)
// ===========================================================================

const atualizarMetricasSchema = z.object({ post_id: uuidLike });

export async function atualizarMetricasPostAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = atualizarMetricasSchema.safeParse({ post_id: fd(formData, "post_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await sincronizarMetricasPost(parsed.data.post_id);
  if (r.ok === 0 && r.erros.length > 0) return { error: r.erros.join(" | ") };

  // Descobre o client_id pra revalidar a página certa.
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("social_media_posts")
    .select("client_id")
    .eq("id", parsed.data.post_id)
    .single();
  if (data?.client_id) revalidatePath(`/social-media/${data.client_id}`);
  return { success: true };
}
