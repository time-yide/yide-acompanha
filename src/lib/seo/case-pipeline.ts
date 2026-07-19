import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { parseCasePolido, type CasePolido } from "./case-parse";
import type { Resultado } from "./case-queries";

const CASE_MODEL = "claude-haiku-4-5";

export interface DadosCase {
  cliente: string; segmento: string; localidade: string;
  desafio: string; solucao: string; resultados: Resultado[];
  depoimento_texto: string; depoimento_autor: string;
}

export function montarPromptCase(d: DadosCase): string {
  const res = d.resultados.map((r) => `- ${r.rotulo}: ${r.valor}`).join("\n") || "(sem números informados)";
  return `Você é redator(a) da Yide Digital. Escreva a narrativa de um CASE de sucesso em pt-br, a partir dos DADOS REAIS abaixo. Regras rígidas:
- Use SOMENTE os números fornecidos. NUNCA invente métricas, percentuais ou resultados que não estejam na lista.
- Estruture: contexto do cliente, o desafio, o que a Yide fez, e os resultados (citando os números dados).
- Tom profissional, verdadeiro, sem exagero. NUNCA use travessão nem meia-risca.

DADOS:
Cliente: ${d.cliente}
Segmento: ${d.segmento}
Localidade: ${d.localidade}
Desafio: ${d.desafio}
O que a Yide fez: ${d.solucao}
Resultados (números reais):
${res}
Depoimento: ${d.depoimento_texto ? `"${d.depoimento_texto}" — ${d.depoimento_autor}` : "(nenhum)"}

Responda SOMENTE com JSON válido:
{"conteudo_md": "narrativa em markdown com ## subtítulos", "meta_title": "SEO até 60 chars", "meta_description": "SEO até 155 chars"}`;
}

export async function polirCase(d: DadosCase): Promise<CasePolido | null> {
  const client = getAnthropicClient();
  if (!client) { console.error("[cases] Anthropic não configurado"); return null; }
  try {
    const res = await client.messages.create({ model: CASE_MODEL, max_tokens: 2500,
      messages: [{ role: "user", content: montarPromptCase(d) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    return parseCasePolido(extrairJson(txt));
  } catch (e) { console.error("[cases] polirCase:", e); return null; }
}
