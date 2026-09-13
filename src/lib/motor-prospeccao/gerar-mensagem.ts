import "server-only";
import { getServerEnv } from "@/lib/env";
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

export async function gerarMensagemPrimeiroContato(
  lead: LeadParaProspectar,
  customPrompt: string | null,
): Promise<{ mensagem: string } | { error: string }> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return { error: "OPENAI_API_KEY não configurada" };

  const systemPrompt = customPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const contexto = montarContextoLead(lead);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Contexto do lead:\n${contexto}\n\nGere a primeira mensagem de WhatsApp para este lead. Responda APENAS com a mensagem, sem explicações.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `OpenAI ${resp.status}: ${text.slice(0, 200)}` };
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return { error: "OpenAI retornou resposta vazia" };

  return { mensagem: content };
}
