"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/ai/client";

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

  const supabase = await createClient();

  const [{ data: client }, { data: briefingRow }] = await Promise.all([
    sb.from("clients").select("nome, servico_contratado, nicho_id, nichos(nome)").eq("id", clientId).single(),
    supabase.from("client_briefing").select("texto_markdown").eq("client_id", clientId).maybeSingle(),
  ]);

  if (!client) return {};

  const briefing = briefingRow?.texto_markdown ?? "";
  const nicho = (client.nichos as { nome: string } | null)?.nome ?? "";

  const anthropic = getAnthropicClient();
  if (!anthropic) return {};

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Analise os dados deste cliente e sugira uma identidade visual adequada.

Cliente: ${client.nome}
Serviço: ${client.servico_contratado ?? "marketing digital"}
Nicho: ${nicho || "não especificado"}
${briefing ? `Briefing:\n${briefing.slice(0, 2000)}` : "Sem briefing"}

Retorne APENAS um JSON válido (sem markdown, sem explicação) com estes campos:
{
  "cores_primarias": "2-3 cores hex separadas por vírgula",
  "cores_secundarias": "1-2 cores hex complementares",
  "fontes": "nome de 1-2 fontes Google Fonts que combinam com o nicho",
  "tom_voz": "2-3 palavras descrevendo o tom",
  "mood": "2-3 palavras descrevendo o estilo visual",
  "evitar": "o que evitar visualmente",
  "observacoes": "1 frase sobre a identidade visual ideal"
}`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return {};

  try {
    const json = JSON.parse(text.text.trim());
    const guide: DesignStyleGuide = {
      cores_primarias: json.cores_primarias ?? "",
      cores_secundarias: json.cores_secundarias ?? "",
      fontes: json.fontes ?? "",
      tom_voz: json.tom_voz ?? "",
      mood: json.mood ?? "",
      evitar: json.evitar ?? "",
      observacoes: json.observacoes ?? "",
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
