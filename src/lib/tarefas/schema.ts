import { z } from "zod";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",
  "aprovada",
  "agendado",
  "postada",
] as const;
export const TASK_TIPOS = ["geral", "video", "arte"] as const;
export const TASK_FORMATOS = ["feed", "story"] as const;
export const TASK_APROVACOES = [
  "pendente_envio",
  "em_analise",
  "aprovado",
  "ajustes_solicitados",
] as const;

export const taskLinkSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().url("URL inválida").max(500),
});

const tipoFormatoRefinement = <T extends { tipo: (typeof TASK_TIPOS)[number]; formatos: readonly (typeof TASK_FORMATOS)[number][] }>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  if ((data.tipo === "video" || data.tipo === "arte") && data.formatos.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["formatos"],
      message: "Selecione ao menos um formato (Feed ou Story)",
    });
  }
};

export const createTaskSchema = z
  .object({
    /** Pré-gerado no client (UUID) pra alinhar com path de upload de anexos. */
    id: z.string().uuid().optional(),
    titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
    descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
    prioridade: z.enum(PRIORITIES).default("media"),
    tipo: z.enum(TASK_TIPOS).default("geral"),
    formatos: z.array(z.enum(TASK_FORMATOS)).default([]),
    atribuido_a: z.string().uuid("Selecione um responsável"),
    client_id: z.string().uuid().optional().nullable(),
    due_date: z.string().optional().nullable(),
    participantes_ids: z.array(z.string().uuid()).max(10, "Máx. 10 atribuídos adicionais").default([]),
    links: z.array(taskLinkSchema).max(10, "Máx. 10 links").default([]),
    attachment_urls: z.array(z.string().url()).max(10, "Máx. 10 anexos").default([]),
  })
  .superRefine(tipoFormatoRefinement);

export const editTaskSchema = z
  .object({
    id: z.string().uuid(),
    titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
    descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
    prioridade: z.enum(PRIORITIES).default("media"),
    tipo: z.enum(TASK_TIPOS).default("geral"),
    formatos: z.array(z.enum(TASK_FORMATOS)).default([]),
    atribuido_a: z.string().uuid("Selecione um responsável"),
    client_id: z.string().uuid().optional().nullable(),
    due_date: z.string().optional().nullable(),
    status: z.enum(TASK_STATUSES),
    participantes_ids: z.array(z.string().uuid()).max(10).default([]),
    links: z.array(taskLinkSchema).max(10).default([]),
    attachment_urls: z.array(z.string().url()).max(10).default([]),
  })
  .superRefine(tipoFormatoRefinement);

export const requestAdjustmentsSchema = z.object({
  id: z.string().uuid(),
  observacoes: z
    .string()
    .trim()
    .min(3, "Descreva os ajustes (mín. 3 caracteres)")
    .max(2000, "Texto muito longo (máx. 2000)"),
});

export const taskCommentSchema = z.object({
  task_id: z.string().uuid(),
  conteudo: z
    .string()
    .trim()
    .min(1, "Comentário vazio")
    .max(2000, "Comentário muito longo (máx. 2000)"),
});

export const moveStatusSchema = z.object({
  id: z.string().uuid(),
  to_status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
export type TaskLink = z.infer<typeof taskLinkSchema>;

export const artesEntreguesSchema = z
  .number()
  .int()
  .min(0, "Não pode ser negativo");

/**
 * Schema do modal "Concluir Operacionalmente" — exigido pra editor,
 * videomaker, designer e audiovisual_chefe ao mover tarefa pra
 * status `concluida`. Drive link e quantidade entregue obrigatórios;
 * observações livres opcional.
 */
export const concludeOperationalSchema = z.object({
  id: z.string().uuid(),
  drive_link: z.string().url("Link do Drive inválido").max(500),
  artes_entregues: z.coerce
    .number()
    .int("Use número inteiro")
    .min(1, "Mínimo 1")
    .max(999, "Máximo 999"),
  entrega_observacoes: z.string().trim().max(2000).optional(),
});

export type ConcludeOperationalInput = z.infer<typeof concludeOperationalSchema>;
