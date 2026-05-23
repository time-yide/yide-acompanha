"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { logActivityInternal } from "@/lib/produtividade/actions";
import { STATUS_VALORES } from "./tipos";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;
type CreateResult = ActionOk & { id: string } | ActionErr;
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

// ===========================================================================
// Arte CRUD
// ===========================================================================

const createArteSchema = z.object({
  client_id: uuidLike,
  titulo: z.string().trim().min(2, "Título muito curto").max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  formato: z.enum(["feed", "story", "carrossel", "reels", "outro"]).default("feed"),
  status: z.enum(STATUS_VALORES).default("rascunho"),
  midias: z.array(z.string().url()).max(10).default([]),
  copy: z.string().trim().max(4000).optional().nullable(),
  hashtags: z.string().trim().max(2000).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

function parseMidias(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export async function createArteAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = createArteSchema.safeParse({
    client_id: fd(formData, "client_id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    formato: fd(formData, "formato") ?? "feed",
    status: fd(formData, "status") ?? "rascunho",
    midias: parseMidias(formData.get("midias")),
    copy: fd(formData, "copy"),
    hashtags: fd(formData, "hashtags"),
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
  const { data, error } = await sb.from("design_artes").insert({
    organization_id: (client as { organization_id: string }).organization_id,
    client_id: parsed.data.client_id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao,
    formato: parsed.data.formato,
    status: parsed.data.status,
    midias: parsed.data.midias,
    copy: parsed.data.copy,
    hashtags: parsed.data.hashtags,
    observacoes: parsed.data.observacoes,
    fonte_origem: "manual",
    criado_por: actor.id,
  }).select("id").single();
  if (error) return { error: error.message };

  const arteId = (data as { id: string }).id;
  await logActivityInternal(actor.id, "arte_criada", {
    entityType: "design_artes",
    entityId: arteId,
    clientId: parsed.data.client_id,
    metadata: { titulo: parsed.data.titulo, formato: parsed.data.formato },
  });

  revalidatePath("/design");
  revalidatePath(`/design/${parsed.data.client_id}`);
  return { success: true, id: arteId };
}

const updateArteSchema = createArteSchema.extend({
  id: uuidLike,
});

export async function updateArteAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = updateArteSchema.safeParse({
    id: fd(formData, "id"),
    client_id: fd(formData, "client_id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    formato: fd(formData, "formato") ?? "feed",
    status: fd(formData, "status") ?? "rascunho",
    midias: parseMidias(formData.get("midias")),
    copy: fd(formData, "copy"),
    hashtags: fd(formData, "hashtags"),
    observacoes: fd(formData, "observacoes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("design_artes")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      formato: parsed.data.formato,
      status: parsed.data.status,
      midias: parsed.data.midias,
      copy: parsed.data.copy,
      hashtags: parsed.data.hashtags,
      observacoes: parsed.data.observacoes,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/design");
  revalidatePath(`/design/${parsed.data.client_id}`);
  return { success: true };
}

const archiveArteSchema = z.object({ id: uuidLike });

export async function archiveArteAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = archiveArteSchema.safeParse({ id: fd(formData, "id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("design_artes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/design");
  return { success: true };
}

const changeStatusSchema = z.object({
  id: uuidLike,
  status: z.enum(STATUS_VALORES),
});

export async function changeArteStatusAction(formData: FormData): Promise<ActionResult> {
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
  if (parsed.data.status === "publicado") {
    updatePayload.publicado_em = new Date().toISOString();
  }
  const { error } = await sb
    .from("design_artes")
    .update(updatePayload)
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  if (parsed.data.status === "aprovado") {
    await logActivityInternal(actor.id, "arte_aprovada", {
      entityType: "design_artes",
      entityId: parsed.data.id,
    });
  }

  revalidatePath("/design");
  return { success: true };
}

// ===========================================================================
// Style guide
// ===========================================================================

const styleGuideSchema = z.object({
  client_id: uuidLike,
  paletas: z.array(z.string().max(20)).max(20).default([]),
  fontes_titulos: z.array(z.string().max(80)).max(10).default([]),
  fontes_corpo: z.array(z.string().max(80)).max(10).default([]),
  mood: z.string().trim().max(1000).optional().nullable(),
  tom_voz: z.string().trim().max(1000).optional().nullable(),
  referencias: z.array(z.string().url()).max(20).default([]),
  evitar: z.string().trim().max(2000).optional().nullable(),
  marca: z.string().trim().max(1000).optional().nullable(),
  exemplos_aprovados: z.array(z.string().url()).max(20).default([]),
});

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

export async function updateStyleGuideAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = styleGuideSchema.safeParse({
    client_id: fd(formData, "client_id"),
    paletas: parseStringArray(formData.get("paletas")),
    fontes_titulos: parseStringArray(formData.get("fontes_titulos")),
    fontes_corpo: parseStringArray(formData.get("fontes_corpo")),
    mood: fd(formData, "mood"),
    tom_voz: fd(formData, "tom_voz"),
    referencias: parseStringArray(formData.get("referencias")),
    evitar: fd(formData, "evitar"),
    marca: fd(formData, "marca"),
    exemplos_aprovados: parseStringArray(formData.get("exemplos_aprovados")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const styleGuide = {
    paletas: parsed.data.paletas,
    fontes_titulos: parsed.data.fontes_titulos,
    fontes_corpo: parsed.data.fontes_corpo,
    mood: parsed.data.mood ?? "",
    tom_voz: parsed.data.tom_voz ?? "",
    referencias: parsed.data.referencias,
    evitar: parsed.data.evitar ?? "",
    marca: parsed.data.marca ?? "",
    exemplos_aprovados: parsed.data.exemplos_aprovados,
  };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("clients")
    .update({ design_style_guide: styleGuide })
    .eq("id", parsed.data.client_id);
  if (error) return { error: error.message };

  revalidatePath(`/design/${parsed.data.client_id}`);
  return { success: true };
}

// ===========================================================================
// Upload de mídia (Storage bucket design-criativos)
// ===========================================================================

const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime",
];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export async function uploadDesignMidiaAction(
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

  // Pega organization_id do cliente
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

  // Path: orgId/clientId/timestamp-uuid.ext
  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const path = `${orgId}/${clientId}/${filename}`;

  const { error: uploadErr } = await sb.storage
    .from("design-criativos")
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  // Signed URL longa (7 dias) - pra exibir no UI
  const { data: signed } = await sb.storage
    .from("design-criativos")
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL" };

  return { url: signed.signedUrl };
}

// ===========================================================================
// Geração com IA - placeholder Fase 2
// ===========================================================================

export async function generateArteAiAction(_formData: FormData): Promise<ActionResult> {
  await requireAuth();
  return {
    error: "Geração com IA chega na Fase 2. Por enquanto, faça upload manual da arte.",
  };
}
