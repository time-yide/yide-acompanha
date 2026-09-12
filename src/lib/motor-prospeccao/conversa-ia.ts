import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import {
  CONVERSA_IA_TOOLS,
  DEFAULT_WPP_SYSTEM_PROMPT,
} from "./conversa-ia-types";
import type { ConversaIAContext } from "./conversa-ia-types";
import {
  handleAgendarReuniao,
  handleMarcarSemInteresse,
  handleEscalarHumano,
  handleEncerrarConversa,
} from "./tool-handlers";

function sb() {
  return createServiceRoleClient() as any;
}

export async function buildConversaContext(
  conversationId: string,
): Promise<ConversaIAContext | null> {
  const { data: conv } = await sb()
    .from("wpp_conversations")
    .select("id, organization_id, lead_gerado_id, ai_config_id, contato_nome")
    .eq("id", conversationId)
    .single();

  if (!conv) return null;

  let systemPrompt = DEFAULT_WPP_SYSTEM_PROMPT;
  if (conv.ai_config_id) {
    const { data: config } = await sb()
      .from("ai_voice_configs")
      .select("wpp_system_prompt")
      .eq("id", conv.ai_config_id)
      .single();

    if (config?.wpp_system_prompt?.trim()) {
      systemPrompt = config.wpp_system_prompt;
    }
  }

  let leadContext = "";
  if (conv.lead_gerado_id) {
    const { data: lead } = await sb()
      .from("leads_gerados")
      .select(
        "empresa, categoria, cidade, estado, website, google_rating, google_reviews_count, porte_empresa, decisor_nome",
      )
      .eq("id", conv.lead_gerado_id)
      .single();

    if (lead) {
      const parts = [`Empresa: ${lead.empresa}`];
      if (lead.categoria) parts.push(`Categoria: ${lead.categoria}`);
      if (lead.cidade)
        parts.push(
          `Cidade: ${lead.cidade}${lead.estado ? `-${lead.estado}` : ""}`,
        );
      parts.push(`Tem site: ${lead.website ? "sim" : "não"}`);
      if (lead.google_rating)
        parts.push(
          `Rating Google: ${lead.google_rating} (${lead.google_reviews_count ?? 0} avaliações)`,
        );
      if (lead.porte_empresa) parts.push(`Porte: ${lead.porte_empresa}`);
      if (lead.decisor_nome) parts.push(`Contato: ${lead.decisor_nome}`);
      leadContext = parts.join("\n");
    }
  }

  const { data: msgs } = await sb()
    .from("wpp_messages")
    .select("autor, texto")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = (msgs ?? []).map((m: { autor: string; texto: string }) => ({
    role: (m.autor === "lead" ? "user" : "assistant") as "user" | "assistant",
    content: m.texto,
  }));

  return {
    conversationId: conv.id,
    orgId: conv.organization_id,
    leadGeradoId: conv.lead_gerado_id,
    configId: conv.ai_config_id,
    systemPrompt,
    leadContext,
    messages,
  };
}

export async function gerarRespostaIA(
  ctx: ConversaIAContext,
): Promise<{ texto: string; toolCalled?: string } | { error: string }> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return { error: "OPENAI_API_KEY não configurada" };

  const systemContent = ctx.leadContext
    ? `${ctx.systemPrompt}\n\n--- Dados do lead ---\n${ctx.leadContext}`
    : ctx.systemPrompt;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...ctx.messages,
      ],
      tools: CONVERSA_IA_TOOLS,
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `OpenAI ${resp.status}: ${text.slice(0, 200)}` };
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) return { error: "OpenAI retornou resposta vazia" };

  const msg = choice.message;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolCall = msg.tool_calls[0];
    const fnName = toolCall.function.name;
    const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

    switch (fnName) {
      case "agendar_reuniao":
        await handleAgendarReuniao(
          ctx.orgId,
          ctx.leadGeradoId,
          ctx.conversationId,
          fnArgs,
        );
        break;
      case "marcar_sem_interesse":
        await handleMarcarSemInteresse(
          ctx.orgId,
          ctx.leadGeradoId,
          ctx.conversationId,
          fnArgs,
        );
        break;
      case "escalar_humano":
        await handleEscalarHumano(
          ctx.orgId,
          ctx.leadGeradoId,
          ctx.conversationId,
          fnArgs,
        );
        break;
      case "encerrar_conversa":
        await handleEncerrarConversa(ctx.conversationId);
        break;
    }

    const texto = msg.content?.trim() || "";
    return { texto, toolCalled: fnName };
  }

  return { texto: msg.content?.trim() || "" };
}
