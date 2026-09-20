import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import {
  DEFAULT_WPP_SYSTEM_PROMPT,
} from "./conversa-ia-types";
import type { ConversaIAContext } from "./conversa-ia-types";
import {
  handleAgendarReuniao,
  handleMarcarSemInteresse,
  handleEscalarHumano,
  handleEncerrarConversa,
} from "./tool-handlers";

const MODEL = "claude-haiku-4-5";

const ANTHROPIC_TOOLS = [
  {
    name: "agendar_reuniao" as const,
    description: "Agenda reunião quando o lead confirma data e horário.",
    input_schema: {
      type: "object" as const,
      properties: {
        data: { type: "string" as const, description: "Data no formato YYYY-MM-DD" },
        horario: { type: "string" as const, description: "Horário no formato HH:MM" },
        duracao_minutos: { type: "number" as const, description: "Duração em minutos (padrão 30)" },
      },
      required: ["data", "horario"],
    },
  },
  {
    name: "marcar_sem_interesse" as const,
    description: "Lead não tem interesse. Usa SOMENTE quando lead recusa pela SEGUNDA vez ou pede explicitamente pra parar.",
    input_schema: {
      type: "object" as const,
      properties: {
        motivo: { type: "string" as const, description: "Motivo dado pelo lead" },
      },
      required: ["motivo"],
    },
  },
  {
    name: "escalar_humano" as const,
    description: "Transfere pra humano. Usa quando lead pede pessoa real ou IA não sabe responder.",
    input_schema: {
      type: "object" as const,
      properties: {
        motivo: { type: "string" as const, description: "Motivo da escalação" },
      },
      required: ["motivo"],
    },
  },
  {
    name: "encerrar_conversa" as const,
    description: "Conversa concluída (reunião marcada ou lead se despediu).",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const client = getAnthropicClient();
  if (!client) return { error: "ANTHROPIC_API_KEY não configurada" };

  const systemContent = ctx.leadContext
    ? `${ctx.systemPrompt}\n\n--- Dados do lead ---\n${ctx.leadContext}`
    : ctx.systemPrompt;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: [{ type: "text", text: systemContent, cache_control: { type: "ephemeral" } }],
      tools: ANTHROPIC_TOOLS,
      messages: ctx.messages,
    });

    let texto = "";
    let toolCalled: string | undefined;

    for (const block of response.content) {
      if (block.type === "text") {
        texto = block.text.trim();
      } else if (block.type === "tool_use") {
        toolCalled = block.name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fnArgs = block.input as any;

        switch (block.name) {
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
      }
    }

    return { texto, toolCalled };
  } catch (e) {
    return { error: `Claude: ${e instanceof Error ? e.message : String(e)}` };
  }
}
