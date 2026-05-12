// Sumarização de reunião via Claude Haiku 4.5 — Fase 3.
//
// Por que Haiku e não Sonnet:
//   - 3-5× mais barato (~R$ 0,17 por reunião vs R$ 0,55)
//   - Qualidade suficiente pra tarefas estruturadas (resumo, extração de
//     tópicos, identificação de citações da transcrição)
//   - Stack já usa Haiku em outros módulos (lib/ai/client.ts).
//
// Estratégia: 1 só call com tool_use (Claude retorna JSON estruturado
// confiável). Mais barato e mais rápido que múltiplas calls.

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/ai/client";
import type {
  InsightTipo,
  MeetingExtractedTask,
  MeetingSummary,
  TranscriptSegment,
} from "../tipos";

const MODEL = "claude-haiku-4-5";

export interface SummarizeOptions {
  transcript: {
    texto_completo: string;
    segments: TranscriptSegment[];
  };
  meeting: {
    titulo: string;
    descricao: string | null;
    /** Contexto opcional do lead/cliente pra IA personalizar. */
    contexto_lead?: string | null;
    contexto_cliente?: string | null;
  };
  participantes: Array<{ id?: string; nome: string; email?: string | null; papel: string }>;
}

export interface SummarizeResult {
  summary: MeetingSummary;
  extracted_tasks: Array<Omit<MeetingExtractedTask, "id" | "task_id" | "atribuido_a_nome" | "estado">>;
  /** Speaker attribution: mapa de speaker_id da Whisper ("inferred-0", "inferred-1") → nome real. */
  speaker_attribution: Record<string, string>;
  custo_estimado_centavos: number;
  custo_estimado_brl_centavos: number;
}

// ─── Schema da tool ────────────────────────────────────────────────────────

const INSIGHT_TIPOS: InsightTipo[] = ["objecao", "sinal_compra", "risco", "oportunidade", "duvida", "decisao"];

const SUMMARIZE_TOOL: Anthropic.Tool = {
  name: "save_meeting_analysis",
  description:
    "Salva a análise estruturada da reunião. Use as evidências da transcrição pra preencher TODOS os campos. " +
    "Cite trechos literais da transcrição em 'citacao' / 'citacao_origem' quando fizer afirmações sobre " +
    "decisões, objeções, sinais de compra ou tarefas. Seja específico e acionável — evite generalidades.",
  input_schema: {
    type: "object",
    properties: {
      resumo_geral: {
        type: "string",
        description:
          "Resumo executivo da reunião em 3-5 parágrafos. Cobrir: contexto, principais pontos discutidos, " +
          "tom geral da conversa e desfecho. Português brasileiro coloquial-profissional.",
      },
      decisoes: {
        type: "array",
        items: { type: "string" },
        description: "Lista de decisões CONCRETAS tomadas (3-7 itens). Cada decisão em 1 frase ativa.",
      },
      proximos_passos: {
        type: "array",
        items: { type: "string" },
        description:
          "Próximos passos acionáveis discutidos (3-7 itens). Quem faz o quê e quando, quando mencionado.",
      },
      topicos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título curto do tópico (max 60 chars)" },
            start_seconds: { type: "number", description: "Segundo em que o tópico começa na reunião" },
            end_seconds: { type: "number", description: "Segundo em que o tópico termina" },
            resumo: { type: "string", description: "Resumo do tópico em 1-2 frases" },
          },
          required: ["titulo", "start_seconds", "end_seconds", "resumo"],
        },
        description:
          "Tópicos macro da reunião com timestamps (3-8 tópicos). Use os timestamps reais dos segments " +
          "da transcrição. Cobrir TODA a reunião sem gaps.",
      },
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: INSIGHT_TIPOS,
              description: "Categoria do insight",
            },
            texto: {
              type: "string",
              description: "Insight em 1-2 frases. Específico e acionável.",
            },
            timestamp_segundos: {
              type: ["number", "null"],
              description: "Segundo em que esse insight foi dito, se aplicável",
            },
            citacao: {
              type: ["string", "null"],
              description: "Trecho LITERAL da transcrição que evidencia o insight (max 200 chars)",
            },
          },
          required: ["tipo", "texto", "timestamp_segundos", "citacao"],
        },
        description: "Insights detectados (0-10). Foque em sinais de compra, objeções, riscos, oportunidades.",
      },
      sentimento_score: {
        type: "number",
        description: "Sentimento geral entre -1.0 (negativo) e 1.0 (positivo)",
      },
      extracted_tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo_sugerido: { type: "string", description: "Título da tarefa (max 100 chars, ação clara)" },
            descricao_sugerida: { type: ["string", "null"], description: "Contexto adicional pra tarefa" },
            atribuido_a_email: {
              type: ["string", "null"],
              description: "Email do participante interno responsável (apenas se mencionado explicitamente)",
            },
            due_date_sugestao: {
              type: ["string", "null"],
              description: "Data sugerida em YYYY-MM-DD (apenas se mencionada explicitamente)",
            },
            citacao_origem: { type: ["string", "null"], description: "Trecho literal que motivou a tarefa" },
            timestamp_origem_segundos: { type: ["number", "null"] },
          },
          required: [
            "titulo_sugerido",
            "descricao_sugerida",
            "atribuido_a_email",
            "due_date_sugestao",
            "citacao_origem",
            "timestamp_origem_segundos",
          ],
        },
        description:
          "Tarefas acionáveis extraídas (3-8 itens). Foco em coisas com responsável e prazo claros. " +
          "NÃO inventar prazos que não foram mencionados — usa null.",
      },
      speaker_attribution: {
        type: "object",
        description:
          "Mapeamento dos speakers genéricos da Whisper ('Speaker 1', 'Speaker 2', ...) pros nomes reais " +
          "dos participantes baseado no contexto da conversa. Use os nomes EXATOS da lista de participantes.",
        additionalProperties: { type: "string" },
      },
    },
    required: [
      "resumo_geral",
      "decisoes",
      "proximos_passos",
      "topicos",
      "insights",
      "sentimento_score",
      "extracted_tasks",
      "speaker_attribution",
    ],
  },
};

// ─── Tipos do output esperado (espelham o schema) ──────────────────────────

interface ToolInput {
  resumo_geral: string;
  decisoes: string[];
  proximos_passos: string[];
  topicos: Array<{
    titulo: string;
    start_seconds: number;
    end_seconds: number;
    resumo: string;
  }>;
  insights: Array<{
    tipo: InsightTipo;
    texto: string;
    timestamp_segundos: number | null;
    citacao: string | null;
  }>;
  sentimento_score: number;
  extracted_tasks: Array<{
    titulo_sugerido: string;
    descricao_sugerida: string | null;
    atribuido_a_email: string | null;
    due_date_sugestao: string | null;
    citacao_origem: string | null;
    timestamp_origem_segundos: number | null;
  }>;
  speaker_attribution: Record<string, string>;
}

// ─── Prompt building ───────────────────────────────────────────────────────

/**
 * Monta a representação da transcrição pro prompt. Inclui timestamps pra
 * Claude conseguir referenciar momentos específicos nos tópicos/insights.
 *
 * Formato:
 *   [00:00 - 00:08] Speaker 1: Oi pessoal, tudo bem?
 *   [00:08 - 00:15] Speaker 2: Tudo ótimo, vamos começar.
 */
function formatTranscriptForPrompt(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const startMin = Math.floor(s.start / 60);
      const startSec = Math.floor(s.start % 60);
      const endMin = Math.floor(s.end / 60);
      const endSec = Math.floor(s.end % 60);
      const t = (m: number, s2: number) => `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
      return `[${t(startMin, startSec)} - ${t(endMin, endSec)}] ${s.speaker}: ${s.text}`;
    })
    .join("\n");
}

function buildSystemPrompt(): string {
  return `Você é uma IA especializada em análise de reuniões comerciais e operacionais brasileiras.

REGRAS IMPORTANTES:
1. Use português brasileiro coloquial-profissional. Evite formalidade excessiva.
2. Seja ESPECÍFICO e ACIONÁVEL. Evite generalidades vazias ("foi uma boa conversa").
3. Cite trechos LITERAIS da transcrição quando fizer afirmações fortes (decisões, objeções, sinais de compra).
4. NÃO invente informação que não está na transcrição. Se algo não foi mencionado, deixe null/vazio.
5. Pra tarefas: só preencha 'atribuido_a_email' se o responsável foi mencionado explicitamente.
   Pra 'due_date_sugestao': mesma coisa — só preenche se vc tem evidência clara.
6. Pra 'speaker_attribution': baseie em pistas do contexto (cumprimentos, autorreferências, tópicos
   discutidos). Se não conseguir identificar, deixe o nome genérico ("Speaker 1").
7. Use timestamps reais dos segments — não invente.

SUA SAÍDA DEVE USAR A TOOL save_meeting_analysis. NÃO escreva texto livre.`;
}

function buildUserMessage(opts: SummarizeOptions): string {
  const parts: string[] = [];

  parts.push(`# Reunião: ${opts.meeting.titulo}`);
  if (opts.meeting.descricao) {
    parts.push(`\n**Descrição:** ${opts.meeting.descricao}`);
  }
  if (opts.meeting.contexto_lead) {
    parts.push(`\n**Lead vinculado:** ${opts.meeting.contexto_lead}`);
  }
  if (opts.meeting.contexto_cliente) {
    parts.push(`\n**Cliente vinculado:** ${opts.meeting.contexto_cliente}`);
  }

  parts.push("\n## Participantes\n");
  for (const p of opts.participantes) {
    const role = p.papel === "host" ? " (host)" : "";
    const email = p.email ? ` <${p.email}>` : "";
    parts.push(`- ${p.nome}${role}${email}`);
  }

  parts.push("\n## Transcrição (com timestamps em [MM:SS - MM:SS])\n");
  parts.push(formatTranscriptForPrompt(opts.transcript.segments));

  parts.push(
    "\n\n---\n\nAnalise a transcrição acima e gere a análise completa usando a tool save_meeting_analysis. " +
      "Lembre-se: cite trechos literais quando relevante, não invente prazos/responsáveis, e tente identificar " +
      "quem é cada Speaker baseado no contexto.",
  );

  return parts.join("\n");
}

// ─── Função principal ──────────────────────────────────────────────────────

export async function summarizeMeeting(opts: SummarizeOptions): Promise<SummarizeResult> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  if (opts.transcript.segments.length === 0) {
    throw new Error("Transcrição vazia — nada pra resumir");
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    tools: [SUMMARIZE_TOOL],
    tool_choice: { type: "tool", name: "save_meeting_analysis" },
    messages: [{ role: "user", content: buildUserMessage(opts) }],
  });

  // Procura o tool_use block
  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === SUMMARIZE_TOOL.name,
  );
  if (!toolBlock) {
    throw new Error("Claude não retornou tool_use block esperado");
  }

  const parsed = toolBlock.input as ToolInput;

  // Custo estimado (Haiku 4.5: $1/1M input, $5/1M output)
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const custoUsd = (inputTokens * 1) / 1_000_000 + (outputTokens * 5) / 1_000_000;
  const custoEstimadoCentavos = Math.round(custoUsd * 100);
  // BRL ~5.5x USD — atualizar conforme câmbio
  const custoBrlCentavos = Math.round(custoUsd * 5.5 * 100);

  const summary: MeetingSummary = {
    resumo_geral: parsed.resumo_geral,
    decisoes: parsed.decisoes ?? [],
    proximos_passos: parsed.proximos_passos ?? [],
    topicos: parsed.topicos ?? [],
    insights: (parsed.insights ?? []).filter((i) =>
      (INSIGHT_TIPOS as readonly string[]).includes(i.tipo),
    ),
    sentimento_score: clampSentiment(parsed.sentimento_score),
    provider: "claude",
    modelo: MODEL,
  };

  const extracted_tasks: SummarizeResult["extracted_tasks"] = (parsed.extracted_tasks ?? []).map((t) => ({
    titulo_sugerido: t.titulo_sugerido,
    descricao_sugerida: t.descricao_sugerida ?? null,
    // O caller (cron) resolve atribuido_a_email → profile_id buscando em profiles.email.
    // Aqui só carregamos como string pro caller processar.
    atribuido_a_sugestao: (t.atribuido_a_email as unknown as string) ?? null,
    due_date_sugestao: t.due_date_sugestao ?? null,
    citacao_origem: t.citacao_origem ?? null,
    timestamp_origem_segundos: t.timestamp_origem_segundos ?? null,
  }));

  return {
    summary,
    extracted_tasks,
    speaker_attribution: parsed.speaker_attribution ?? {},
    custo_estimado_centavos: custoEstimadoCentavos,
    custo_estimado_brl_centavos: custoBrlCentavos,
  };
}

function clampSentiment(v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}
