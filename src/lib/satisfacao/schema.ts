import { z } from "zod";

export const SATISFACTION_COLORS = ["verde", "amarelo", "vermelho"] as const;
export type SatisfactionColor = typeof SATISFACTION_COLORS[number];

// =============================================
// Server actions (zod schemas)
// =============================================

export const setColorSchema = z.object({
  client_id: z.string().uuid(),
  cor: z.enum(SATISFACTION_COLORS),
});

export const setCommentSchema = z.object({
  client_id: z.string().uuid(),
  comentario: z.string().max(2000, "Comentário muito longo").optional().nullable(),
});

export type SetColorInput = z.infer<typeof setColorSchema>;
export type SetCommentInput = z.infer<typeof setCommentSchema>;

// =============================================
// Synthesizer (input/output)
// =============================================

export interface SynthesisInput {
  client: {
    id: string;
    nome: string;
    valor_mensal: number;
    data_entrada: string;          // ISO date 'YYYY-MM-DD'
    servico_contratado: string | null;
  };
  current_week_iso: string;
  current_entries: Array<{
    papel: string;
    cor: SatisfactionColor;
    comentario: string | null;
  }>;
  history_4_weeks: Array<{
    semana_iso: string;
    cor_final: SatisfactionColor;
    resumo_ia: string;
  }>;
}

export interface SynthesisOutput {
  score_final: number;             // 0.0 - 10.0
  cor_final: SatisfactionColor;
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  ai_tokens_used: number;
}

// Zod schema pro retorno parseado da IA (validação)
export const synthesisOutputSchema = z.object({
  score_final: z.coerce.number().min(0).max(10),
  cor_final: z.enum(SATISFACTION_COLORS),
  resumo_ia: z.string().min(1),
  divergencia_detectada: z.boolean(),
  acao_sugerida: z.string().nullable().optional(),
});
