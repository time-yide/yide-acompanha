// SERVER ONLY — extrai o checklist da semana da transcrição do check-in.
import { getAnthropicClient } from "@/lib/ai/client";

const MODEL = "claude-haiku-4-5";

export interface ItemExtraido {
  texto: string;
  cliente: string | null;
  citacao: string | null;
}

export function parseItensCheck(raw: string): ItemExtraido[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = JSON.parse(match[0]) as any;
    if (!Array.isArray(j.itens)) return null;
    return j.itens
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i && typeof i.texto === "string" && i.texto.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => ({
        texto: i.texto.trim().slice(0, 500),
        cliente: typeof i.cliente === "string" && i.cliente.trim() ? i.cliente.trim() : null,
        citacao: typeof i.citacao === "string" ? i.citacao.slice(0, 500) : null,
      }));
  } catch {
    return null;
  }
}

export type ExtrairResult =
  | { ok: true; itens: ItemExtraido[] }
  | { ok: false; skipped: boolean; error: string | null };

export async function extrairItensCheck(input: {
  assessorNome: string;
  clientes: string[];
  textoCompleto: string;
}): Promise<ExtrairResult> {
  const client = getAnthropicClient();
  if (!client) return { ok: false, skipped: true, error: null };
  if (!input.textoCompleto.trim()) return { ok: false, skipped: false, error: "transcrição vazia" };

  const prompt = `Esta é a transcrição do CHECK-IN semanal (segunda-feira) entre a gestão da agência e o assessor "${input.assessorNome}". Nele se combina o que o assessor precisa fazer de segunda a quinta para os clientes da carteira dele.

Clientes da carteira:
${input.clientes.map((c) => `- ${c}`).join("\n") || "- (sem clientes cadastrados)"}

Liste TODAS as tarefas combinadas para o assessor fazer nesta semana. Cada item deve ser uma ação concreta e verificável na quinta (ex.: "Enviar relatório de outubro pro cliente"). Não invente itens; não inclua o que foi só comentado sem combinar.

Responda APENAS com JSON válido:
{"itens":[{"texto":"ação a fazer","cliente":"nome exatamente como na lista acima, ou null se for geral","citacao":"trecho curto da fala que originou"}]}

Transcrição:
${input.textoCompleto.slice(0, 30000)}`;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: [{
        type: "text",
        text: "Você transforma transcrições de reuniões de check-in de uma agência de marketing em checklists de tarefas por cliente, em português do Brasil, respondendo só em JSON.",
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: prompt }],
    });
    const raw = resp.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const itens = parseItensCheck(raw);
    if (!itens) return { ok: false, skipped: false, error: "resposta sem JSON válido" };
    return { ok: true, itens };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : "erro Claude" };
  }
}
