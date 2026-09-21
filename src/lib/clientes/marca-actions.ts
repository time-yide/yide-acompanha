"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import type Anthropic from "@anthropic-ai/sdk";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface DesignStyleGuide {
  tom_voz?: string;
  mood?: string;
  evitar?: string;
  cores_primarias?: string;
  cores_secundarias?: string;
  fontes?: string;
  logo_url?: string;
  referencias_instagram?: string;
  observacoes?: string;
}

async function getUserOrgId(sb: SB, userId: string): Promise<string | null> {
  const { data } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  return data?.organization_id ?? null;
}

export async function getStyleGuide(clientId: string): Promise<DesignStyleGuide> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;

  const orgId = await getUserOrgId(sb, user.id);
  if (!orgId) return {};

  const { data } = await sb
    .from("clients")
    .select("design_style_guide, organization_id")
    .eq("id", clientId)
    .single();

  if (!data || data.organization_id !== orgId) return {};
  return (data.design_style_guide ?? {}) as DesignStyleGuide;
}

export async function saveStyleGuideAction(clientId: string, guide: DesignStyleGuide) {
  const user = await requireAuth();
  if (!["adm", "socio", "assessor", "coordenador"].includes(user.role)) {
    return { error: "Sem permissão" };
  }

  const sb = createServiceRoleClient() as SB;

  const orgId = await getUserOrgId(sb, user.id);
  if (!orgId) return { error: "Sem permissão" };

  const { data: client } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .single();

  if (!client || client.organization_id !== orgId) {
    return { error: "Sem permissão" };
  }

  const { error } = await sb
    .from("clients")
    .update({
      design_style_guide: guide,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

async function fetchPostImages(sb: SB, clientId: string, orgId: string): Promise<Buffer[]> {
  const { data: posts } = await sb
    .from("social_media_posts")
    .select("midias")
    .eq("client_id", clientId)
    .eq("organization_id", orgId)
    .not("midias", "is", null)
    .eq("status", "publicado")
    .order("publicado_em", { ascending: false })
    .limit(6);

  if (!posts || posts.length === 0) return [];

  const urls: string[] = [];
  for (const post of posts) {
    const midias = Array.isArray(post.midias) ? post.midias : [];
    for (const url of midias) {
      if (typeof url === "string" && url.startsWith("http") && !url.endsWith(".mp4")) {
        urls.push(url);
        if (urls.length >= 4) break;
      }
    }
    if (urls.length >= 4) break;
  }

  const buffers: Buffer[] = [];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const ab = await resp.arrayBuffer();
      if (ab.byteLength > 4 * 1024 * 1024) continue;
      buffers.push(Buffer.from(ab));
    } catch {
      continue;
    }
  }
  return buffers;
}

export async function autoGenerateStyleGuide(clientId: string): Promise<DesignStyleGuide> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const orgId = await getUserOrgId(sb, user.id);
  if (!orgId) return {};

  const { data: clientCheck } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .single();
  if (!clientCheck || clientCheck.organization_id !== orgId) return {};

  const [{ data: client }, { data: briefingRow }] = await Promise.all([
    sb.from("clients").select("nome, servico_contratado, nicho_id, nichos(nome), instagram_url").eq("id", clientId).single(),
    sb.from("client_briefing").select("texto_markdown").eq("client_id", clientId).maybeSingle(),
  ]);

  if (!client) return {};

  const briefing = briefingRow?.texto_markdown ?? "";
  const nicho = (client.nichos as { nome: string } | null)?.nome ?? "";
  const instagram = client.instagram_url ?? "";

  const anthropic = getAnthropicClient();
  if (!anthropic) return {};

  const images = await fetchPostImages(sb, clientId, orgId);

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  if (images.length > 0) {
    for (const buf of images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") },
      });
    }
  }

  const textPrompt = `Analise os dados deste cliente${images.length > 0 ? " e as imagens de posts recentes do Instagram dele" : ""} e sugira uma identidade visual adequada.

Cliente: ${client.nome}
Serviço: ${client.servico_contratado ?? "marketing digital"}
Nicho: ${nicho || "não especificado"}
${instagram ? `Instagram: ${instagram}` : ""}
${briefing ? `Briefing:\n${briefing.slice(0, 2000)}` : "Sem briefing"}
${images.length > 0 ? `\nAs ${images.length} imagens acima são posts recentes do Instagram deste cliente. Analise as cores dominantes, estilo visual, mood e padrões que aparecem.` : ""}

Retorne APENAS um JSON válido (sem markdown, sem explicação) com estes campos:
{
  "cores_primarias": "2-3 cores hex separadas por vírgula, extraídas das imagens se disponíveis",
  "cores_secundarias": "1-2 cores hex complementares",
  "fontes": "nome de 1-2 fontes Google Fonts que combinam com o estilo",
  "tom_voz": "2-3 palavras descrevendo o tom",
  "mood": "2-3 palavras descrevendo o estilo visual",
  "evitar": "o que evitar visualmente",
  "observacoes": "1 frase sobre a identidade visual ideal"
}`;

  content.push({ type: "text", text: textPrompt });

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    messages: [{ role: "user", content }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return {};

  try {
    const raw = text.text.trim().replace(/^```json\s*/, "").replace(/```\s*$/, "");
    const json = JSON.parse(raw);
    const guide: DesignStyleGuide = {
      cores_primarias: json.cores_primarias ?? "",
      cores_secundarias: json.cores_secundarias ?? "",
      fontes: json.fontes ?? "",
      tom_voz: json.tom_voz ?? "",
      mood: json.mood ?? "",
      evitar: json.evitar ?? "",
      observacoes: json.observacoes ?? "",
      referencias_instagram: instagram,
    };

    await sb
      .from("clients")
      .update({ design_style_guide: guide, updated_at: new Date().toISOString() })
      .eq("id", clientId);

    return guide;
  } catch {
    return {};
  }
}
