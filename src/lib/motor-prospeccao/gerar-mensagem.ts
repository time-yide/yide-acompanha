import "server-only";
import { getServerEnv } from "@/lib/env";
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
