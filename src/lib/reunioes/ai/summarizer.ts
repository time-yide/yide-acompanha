// SERVER ONLY — resumo/insights/tarefas via Claude Haiku.
import { getAnthropicClient } from "@/lib/ai/client";

const MODEL = "claude-haiku-4-5";
const TIPOS = ["objecao", "sinal_compra", "risco", "oportunidade", "duvida", "decisao"];

export interface InsightGerado { tipo: string; texto: string; timestamp_segundos: number | null; citacao: string | null; }
export interface TarefaGerada { titulo: string; descricao: string | null; citacao: string | null; timestamp_segundos: number | null; }
export interface SummarizeParsed {
  resumo_geral: string;
  decisoes: string[];
  proximos_passos: string[];
  insights: InsightGerado[];
  tarefas: TarefaGerada[];
}
export interface SummarizeInput { titulo: string; clienteNome: string | null; textoCompleto: string; }
export interface SummarizeResult { ok: boolean; skipped: boolean; error: string | null; data: SummarizeParsed | null; custo_estimado_centavos: number; }

export function parseSummaryResponse(raw: string): SummarizeParsed | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j = JSON.parse(match[0]) as any;
    const arrStr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
    return {
      resumo_geral: typeof j.resumo_geral === "string" ? j.resumo_geral : "",
      decisoes: arrStr(j.decisoes),
      proximos_passos: arrStr(j.proximos_passos),
      insights: Array.isArray(j.insights)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? j.insights.filter((i: any) => i && typeof i.texto === "string").map((i: any) => ({
            tipo: TIPOS.includes(i.tipo) ? i.tipo : "oportunidade",
            texto: i.texto,
            timestamp_segundos: typeof i.timestamp_segundos === "number" ? i.timestamp_segundos : null,
            citacao: typeof i.citacao === "string" ? i.citacao : null,
          }))
        : [],
      tarefas: Array.isArray(j.tarefas)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? j.tarefas.filter((t: any) => t && typeof t.titulo === "string").map((t: any) => ({
            titulo: t.titulo,
            descricao: typeof t.descricao === "string" ? t.descricao : null,
            citacao: typeof t.citacao === "string" ? t.citacao : null,
            timestamp_segundos: typeof t.timestamp_segundos === "number" ? t.timestamp_segundos : null,
          }))
        : [],
    };
  } catch {
    return null;
  }
}

export async function summarizeMeeting(input: SummarizeInput): Promise<SummarizeResult> {
  const client = getAnthropicClient();
  if (!client) return { ok: false, skipped: true, error: null, data: null, custo_estimado_centavos: 0 };
  if (!input.textoCompleto.trim()) return { ok: false, skipped: false, error: "transcrição vazia", data: null, custo_estimado_centavos: 0 };

  const prompt = `Você é assistente de uma agência de marketing. Analise a transcrição de uma reunião ${input.clienteNome ? `com o cliente "${input.clienteNome}"` : ""} (título: "${input.titulo}") e produza um JSON.

Responda APENAS com um objeto JSON válido (sem texto antes/depois), neste formato:
{
  "resumo_geral": "3 a 5 frases resumindo a reunião",
  "decisoes": ["decisões tomadas"],
  "proximos_passos": ["próximos passos combinados"],
  "insights": [{"tipo":"objecao|sinal_compra|risco|oportunidade|duvida|decisao","texto":"...","timestamp_segundos":null,"citacao":"trecho literal"}],
  "tarefas": [{"titulo":"tarefa a fazer","descricao":"detalhe","citacao":"trecho que originou","timestamp_segundos":null}]
}
Use listas vazias quando não houver. Tudo em português do Brasil.

Transcrição:
${input.textoCompleto.slice(0, 24000)}`;

  try {
    const resp = await client.messages.create({ model: MODEL, max_tokens: 2048, messages: [{ role: "user", content: prompt }] });
    const raw = resp.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const data = parseSummaryResponse(raw);
    if (!data) return { ok: false, skipped: false, error: "resposta sem JSON válido", data: null, custo_estimado_centavos: 0 };
    return { ok: true, skipped: false, error: null, data, custo_estimado_centavos: 5 };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : "erro Claude", data: null, custo_estimado_centavos: 0 };
  }
}
