import { z } from "zod";

export const QUESTOES_POR_CURSO = 10;
export const NOTA_MINIMA = 7;
export const PONTOS_POR_CURSO = 100;

const questaoSchema = z.object({
  enunciado: z.string().trim().min(1, "Enunciado vazio").max(500, "Enunciado muito longo"),
  alternativas: z
    .array(z.string().trim().min(1, "Alternativa vazia").max(300, "Alternativa muito longa"))
    .length(4, "Cada questão precisa ter 4 alternativas"),
  correta: z.coerce.number().int().min(0).max(3),
});

export const createCursoSchema = z.object({
  titulo: z.string().trim().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().trim().min(1, "Descrição obrigatória"),
  responsaveis_ids: z.array(z.string().uuid()).min(1, "Atribua pelo menos um responsável"),
  questoes: z.array(questaoSchema).length(
    QUESTOES_POR_CURSO,
    `O questionário precisa ter exatamente ${QUESTOES_POR_CURSO} questões`,
  ),
});

export const submitProvaSchema = z.object({
  curso_id: z.string().uuid(),
  // respostas: array de int 0..3 com tamanho QUESTOES_POR_CURSO
  respostas: z
    .array(z.coerce.number().int().min(0).max(3))
    .length(QUESTOES_POR_CURSO, `Responda todas as ${QUESTOES_POR_CURSO} questões`),
});

export type CreateCursoInput = z.infer<typeof createCursoSchema>;
export type QuestaoInput = z.infer<typeof questaoSchema>;
