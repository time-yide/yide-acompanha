import "server-only";
import { getAnthropicClient } from "@/lib/ai/client";
import type { LeadParaProspectar } from "./types";

const DEFAULT_SYSTEM_PROMPT = `Você é a Ana, da Yide Digital. Está mandando a PRIMEIRA mensagem de WhatsApp pra um potencial cliente. O objetivo é iniciar um BATE-PAPO casual, NÃO vender nada ainda.

REGRA PRINCIPAL: a primeira mensagem é SÓ um cumprimento simpático e curto. Não mencione a Yide, não fale de marketing, não ofereça serviço, não faça pitch. É só um "oi" natural.

Gere UMA mensagem curta de cumprimento. Exemplos de estilo:
- "Oi, tudo bem? 😊"
- "Oii, tudo bem?"
- "Oi! Tudo bem com você? 😊"
- "E aí, tudo bem? 😊"
- "Oii! Tudo bom?"

Regras:
- Máximo 1 linha
- Use emoji SOMENTE 😊 e no máximo 1
- Varie entre as formas acima pra não ficar repetitivo
- NÃO se apresente, NÃO mencione empresa, NÃO fale de serviço
- NÃO use "Prezado", "Bom dia", "Boa tarde"
- Pareça uma pessoa real mandando mensagem, não um robô`;

function montarContextoLead(lead: LeadParaProspectar): string {
  const parts = [`Empresa: ${lead.empresa}`];
  if (lead.categoria) parts.push(`Categoria: ${lead.categoria}`);
  if (lead.cidade) parts.push(`Cidade: ${lead.cidade}${lead.estado ? `-${lead.estado}` : ""}`);
  parts.push(`Tem site: ${lead.website ? "sim" : "não"}`);
  if (lead.google_rating) {
    parts.push(
      `Rating Google: ${lead.google_rating} (${lead.google_reviews_count ?? 0} avaliações)`,
    );
  }
  if (lead.porte_empresa) parts.push(`Porte: ${lead.porte_empresa}`);
  if (lead.decisor_nome) parts.push(`Contato: ${lead.decisor_nome}`);
  return parts.join("\n");
}

const REENGAJAMENTO_PROMPT = `Você é a assistente comercial da Yide Digital. Gere uma mensagem curta e natural de reengajamento para a empresa informada. O tom deve ser amigável e trazer um gancho novo (ex: novidade, oportunidade, pergunta). NÃO mencione que já tentamos contato antes. Máximo 2 frases. Assine como "Equipe Yide".`;

const MODEL = "claude-haiku-4-5";

export async function gerarMensagemReengajamento(
  empresa: string,
): Promise<{ mensagem: string } | { error: string }> {
  const client = getAnthropicClient();
  if (!client) return { error: "ANTHROPIC_API_KEY não configurada" };

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      system: [{ type: "text", text: REENGAJAMENTO_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Empresa: ${empresa || "empresa local"}\n\nGere a mensagem de reengajamento. Responda APENAS com a mensagem, sem explicações.`,
      }],
    });

    const content = res.content.find((b) => b.type === "text");
    if (!content || content.type !== "text" || !content.text.trim()) {
      return { error: "IA retornou resposta vazia" };
    }
    return { mensagem: content.text.trim() };
  } catch (e) {
    return { error: `Claude: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function gerarMensagemPrimeiroContato(
  lead: LeadParaProspectar,
  customPrompt: string | null,
): Promise<{ mensagem: string } | { error: string }> {
  const client = getAnthropicClient();
  if (!client) return { error: "ANTHROPIC_API_KEY não configurada" };

  const systemPrompt = customPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const contexto = montarContextoLead(lead);

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Contexto do lead:\n${contexto}\n\nGere a primeira mensagem de WhatsApp para este lead. Responda APENAS com a mensagem, sem explicações.`,
      }],
    });

    const content = res.content.find((b) => b.type === "text");
    if (!content || content.type !== "text" || !content.text.trim()) {
      return { error: "IA retornou resposta vazia" };
    }
    return { mensagem: content.text.trim() };
  } catch (e) {
    return { error: `Claude: ${e instanceof Error ? e.message : String(e)}` };
  }
}
