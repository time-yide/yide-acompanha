import { z } from "zod";

const ratingField = z.coerce
  .number()
  .int()
  .min(1, "Selecione de 1 a 5")
  .max(5, "Selecione de 1 a 5");

export const createCapturaSchema = z.object({
  event_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid("Selecione o cliente"),
  data_captacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  drive_url: z.string().url("Link do Drive inválido").max(500),
  qtd_videos: z.coerce.number().int().min(0).default(0),
  qtd_fotos: z.coerce.number().int().min(0).default(0),
  observacoes: z.string().max(2000).optional().nullable(),

  rating_organizacao: ratingField,
  rating_facilidade: ratingField,
  rating_execucao_roteiro: ratingField,
  rating_atrasos: ratingField,
  rating_comunicacao: ratingField,
  rating_retrabalho: ratingField,
  rating_colaboracao: ratingField,

  pontos_positivos: z.string().max(2000).optional().nullable(),
  pontos_dificuldade: z.string().max(2000).optional().nullable(),
  sugestoes: z.string().max(2000).optional().nullable(),
});

export type CreateCapturaInput = z.infer<typeof createCapturaSchema>;

/**
 * Schema "modo rápido": pra quando a entrega já aconteceu fora do sistema
 * (videomaker mandou drive direto, deu erro no form completo, etc.) e o
 * usuário só quer marcar como entregue pra sair da lista de pendentes.
 *
 * Diferenças do schema completo:
 *  - `drive_url` é OPCIONAL (placeholder "-" se vazio)
 *  - Todos os 7 ratings são OPCIONAIS (não força avaliação de feedback)
 *  - `event_id` obrigatório (vem do clique no card)
 *  - `client_id` opcional (busca do event_id se não vier)
 */
export const markEntregueRapidoSchema = z.object({
  event_id: z.string().uuid(),
  drive_url: z.union([
    z.string().url("Link do Drive inválido").max(500),
    z.literal(""),
  ]).optional(),
  observacoes: z.string().max(2000).optional().nullable(),
});

export type MarkEntregueRapidoInput = z.infer<typeof markEntregueRapidoSchema>;

export const RATING_FIELDS = [
  { name: "rating_organizacao", label: "Organização do cliente" },
  { name: "rating_facilidade", label: "Facilidade na gravação" },
  { name: "rating_execucao_roteiro", label: "Execução do roteiro" },
  { name: "rating_atrasos", label: "Pontualidade (sem atrasos)" },
  { name: "rating_comunicacao", label: "Comunicação" },
  { name: "rating_retrabalho", label: "Sem retrabalho" },
  { name: "rating_colaboracao", label: "Colaboração durante a captação" },
] as const;
