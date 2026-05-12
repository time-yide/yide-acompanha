"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

interface ActionOk { success: true; postId?: string }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

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

const REDES_VALIDAS = ["instagram", "facebook", "linkedin", "gmn"] as const;

const agendarPostagemSchema = z.object({
  arte_id: uuidLike,
  agendar_para: z.string().min(1, "Data/hora obrigatória"),
  redes: z.array(z.enum(REDES_VALIDAS)).min(1, "Selecione pelo menos uma rede").max(4),
});

/**
 * Mapeia formato da arte (Design) → formato do post (Social Media).
 * São quase iguais; só "outro" não tem equivalente direto e cai em "feed".
 */
function mapFormato(arteFormato: string): "feed" | "story" | "carrossel" | "reels" {
  switch (arteFormato) {
    case "feed":
    case "story":
    case "carrossel":
    case "reels":
      return arteFormato;
    case "outro":
    default:
      return "feed";
  }
}

/**
 * Cria um post no Social Media a partir de uma arte aprovada do Design.
 *
 * Pré-condições:
 * - Arte precisa existir e não estar arquivada
 * - Status precisa ser "aprovado" (pra evitar agendar coisa que ainda tá em rev)
 * - Arte precisa ter ao menos uma mídia
 *
 * Efeitos:
 * - Cria social_media_posts com midias, legenda (do arte.copy), hashtags
 *   e design_arte_id linkando de volta
 * - Atualiza arte: status="agendado", agendado_para=<a data escolhida>
 *
 * Retorna { success: true, postId } com o ID do post criado.
 */
export async function agendarPostagemFromArteAction(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  let redes: string[] = [];
  try {
    const raw = formData.get("redes");
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) redes = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    return { error: "Formato de redes inválido" };
  }

  const parsed = agendarPostagemSchema.safeParse({
    arte_id: formData.get("arte_id"),
    agendar_para: formData.get("agendar_para"),
    redes,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Carrega a arte
  const { data: arteData, error: arteErr } = await sb
    .from("design_artes")
    .select("id, client_id, organization_id, titulo, descricao, formato, status, midias, copy, hashtags, archived_at")
    .eq("id", parsed.data.arte_id)
    .single();
  if (arteErr || !arteData) return { error: "Arte não encontrada" };

  const arte = arteData as {
    id: string;
    client_id: string;
    organization_id: string;
    titulo: string;
    descricao: string | null;
    formato: string;
    status: string;
    midias: unknown;
    copy: string | null;
    hashtags: string | null;
    archived_at: string | null;
  };

  if (arte.archived_at) return { error: "Arte foi arquivada" };
  if (arte.status !== "aprovado") {
    return { error: "Arte precisa estar aprovada antes de agendar postagem" };
  }
  if (!Array.isArray(arte.midias) || arte.midias.length === 0) {
    return { error: "Arte sem mídias — adicione antes de agendar" };
  }

  // Valida que data é futura
  const agendarDate = new Date(parsed.data.agendar_para);
  if (isNaN(agendarDate.getTime())) {
    return { error: "Data/hora inválida" };
  }
  if (agendarDate.getTime() < Date.now() - 60_000) {
    // tolerância de 1 min pra evitar erro por relógio dessincronizado
    return { error: "Data/hora precisa ser no futuro" };
  }

  // Cria o post
  const { data: postData, error: postErr } = await sb
    .from("social_media_posts")
    .insert({
      organization_id: arte.organization_id,
      client_id: arte.client_id,
      titulo: arte.titulo,
      legenda: arte.copy,
      hashtags: arte.hashtags,
      formato: mapFormato(arte.formato),
      redes: parsed.data.redes,
      midias: arte.midias,
      agendar_para: agendarDate.toISOString(),
      status: "agendado",
      design_arte_id: arte.id,
      observacoes: arte.descricao,
      criado_por: actor.id,
    })
    .select("id")
    .single();

  if (postErr || !postData) {
    return { error: postErr?.message ?? "Erro ao criar post" };
  }

  const post = postData as { id: string };

  // Atualiza arte: agendada
  const { error: updErr } = await sb
    .from("design_artes")
    .update({
      status: "agendado",
      agendado_para: agendarDate.toISOString(),
    })
    .eq("id", arte.id);

  if (updErr) {
    // Não é fatal — post foi criado mas arte não atualizou. Loga e segue.
    console.error("[design->social] arte.status update falhou:", updErr.message);
  }

  revalidatePath("/design");
  revalidatePath(`/design/${arte.client_id}`);
  revalidatePath("/social-media");
  revalidatePath(`/social-media/${arte.client_id}`);
  return { success: true, postId: post.id };
}
