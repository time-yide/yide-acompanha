// Geração de resumo/insights/tasks via Claude - STUB pra Fase 3.
//
// Stack já tem @anthropic-ai/sdk + um cliente em src/lib/ai/client.ts
// (usado pelo Gerador de Leads). Reusamos.
//
// Modelo recomendado: claude-sonnet-4-5-20250929 (melhor relação custo/qualidade
// pra reasoning longo de transcrição inteira).
//
// Pra reunião de 1h (~10k tokens de transcrição), 1 call de resumo + tópicos +
// insights + tasks em paralelo (4 calls) custa ~$0.10-0.15 por reunião.
//
// Variáveis .env:
//   ANTHROPIC_API_KEY=sk-ant-... (já existe na stack)

import type { MeetingSummary, MeetingExtractedTask, TranscriptSegment } from "../tipos";

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
  participantes: Array<{ nome: string; papel: string }>;
}

export interface SummarizeResult {
  summary: MeetingSummary;
  extracted_tasks: Omit<MeetingExtractedTask, "id" | "task_id" | "atribuido_a_nome" | "estado">[];
  custo_estimado_centavos: number;
}

/**
 * Pipeline completo de pós-processamento de reunião:
 *  1. Gera resumo geral (3-5 parágrafos)
 *  2. Extrai decisões + próximos passos
 *  3. Identifica tópicos com timestamps
 *  4. Detecta insights (objeção, sinal de compra, etc.)
 *  5. Extrai tasks candidatas com citação da transcrição
 *
 * Idealmente roda como background job - bloqueia 10-30s.
 */
export async function summarizeMeeting(_opts: SummarizeOptions): Promise<SummarizeResult> {
  void _opts;
  throw new Error("Sumarização IA ainda não implementada (Fase 3 do roadmap).");
}
