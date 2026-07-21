import { z } from "zod";

export const PESQUISA_STATUS = ["rascunho", "aberta", "encerrada"] as const;
export type PesquisaStatus = (typeof PESQUISA_STATUS)[number];

export const PESQUISA_STATUS_LABEL: Record<PesquisaStatus, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export const PERGUNTA_TIPOS = ["multipla_escolha", "escala", "sim_nao", "texto"] as const;
export type PerguntaTipo = (typeof PERGUNTA_TIPOS)[number];

export const PERGUNTA_TIPO_LABEL: Record<PerguntaTipo, string> = {
  multipla_escolha: "Múltipla escolha",
  escala: "Escala / nota",
  sim_nao: "Sim / Não",
  texto: "Texto aberto",
};

export const createPesquisaSchema = z.object({
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  anonima: z.coerce.boolean().default(false),
});

/** Uma pergunta no builder (antes de virar linha no banco). */
export const perguntaSchema = z
  .object({
    tipo: z.enum(PERGUNTA_TIPOS),
    enunciado: z.string().min(1, "Escreva a pergunta"),
    opcoes: z.array(z.string().min(1)).optional(),
    escala_min: z.coerce.number().int().optional(),
    escala_max: z.coerce.number().int().optional(),
    obrigatoria: z.coerce.boolean().default(true),
  })
  .refine((p) => p.tipo !== "multipla_escolha" || (p.opcoes?.length ?? 0) >= 2, {
    message: "Múltipla escolha precisa de ao menos 2 opções",
    path: ["opcoes"],
  });

export type PerguntaInput = z.infer<typeof perguntaSchema>;

/** Valida o `valor` (jsonb) de uma resposta conforme o tipo da pergunta. */
export function respostaValorSchema(tipo: PerguntaTipo) {
  switch (tipo) {
    case "multipla_escolha":
      return z.object({ escolha: z.string().min(1) });
    case "escala":
      return z.object({ nota: z.coerce.number().int() });
    case "sim_nao":
      return z.object({ sim_nao: z.coerce.boolean() });
    case "texto":
      return z.object({ texto: z.string().min(1) });
  }
}

export interface PesquisaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  anonima: boolean;
  status: PesquisaStatus;
  criado_por: string | null;
  disparada_em: string | null;
  prazo: string | null;
  encerrada_em: string | null;
  created_at: string;
}

export interface PerguntaRow {
  id: string;
  pesquisa_id: string;
  ordem: number;
  tipo: PerguntaTipo;
  enunciado: string;
  opcoes: string[] | null;
  escala_min: number | null;
  escala_max: number | null;
  obrigatoria: boolean;
}
