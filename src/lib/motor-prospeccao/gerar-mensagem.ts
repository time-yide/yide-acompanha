import "server-only";
import { getAnthropicClient } from "@/lib/ai/client";
import type { LeadParaProspectar } from "./types";

const DEFAULT_SYSTEM_PROMPT = `Você é a assistente comercial da Yide Digital, uma agência de marketing e tecnologia de Cuiabá-MT. Seu objetivo é iniciar uma conversa informal e amigável via WhatsApp com um potencial cliente.

Você vende: marketing digital, gestão de redes sociais, ecommerce (lojas online), CRM e automação de processos.

Regras:
- Primeira mensagem curta e informal, como uma pessoa real mandaria
- Mencione algo específico do nicho do lead
- NÃO mande textão. Máximo 3 linhas
- NÃO use "Prezado" ou linguagem corporativa. Use "Oi", "Oiii", "E aí"
- Faça uma pergunta que convide resposta
- Assine como "Equipe Yide"

Adapte o pitch ao serviço mais relevante:
- Restaurante/bar/café → redes sociais + fotos profissionais + delivery (iFood, Rappi)
- Loja/varejo → ecommerce + tráfego pago + Instagram Shopping
- Clínica/consultório → autoridade digital + Google Meu Negócio + agendamento online
- Serviços (contab/advogado) → LinkedIn + CRM + automação de processos
- Indústria/B2B → site institucional + Google Ads + CRM
- Salão/barbearia/estética → Instagram + antes/depois + agendamento online
- Academia/fitness → redes sociais + app + retenção de alunos
- Pet shop/veterinária → redes sociais + delivery + fidelização

Case real: cliente reduziu 40% do custo operacional com automação.`;

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
