import { z } from "zod";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = ["aberta", "em_andamento", "concluida"] as const;

export const taskLinkSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().url("URL inválida").max(500),
});

export const createTaskSchema = z.object({
  /** Pré-gerado no client (UUID) pra alinhar com path de upload de anexos. */
  id: z.string().uuid().optional(),
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  participantes_ids: z.array(z.string().uuid()).max(10, "Máx. 10 atribuídos adicionais").default([]),
  links: z.array(taskLinkSchema).max(10, "Máx. 10 links").default([]),
  attachment_urls: z.array(z.string().url()).max(10, "Máx. 10 anexos").default([]),
});

export const editTaskSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES),
  participantes_ids: z.array(z.string().uuid()).max(10).default([]),
  links: z.array(taskLinkSchema).max(10).default([]),
  attachment_urls: z.array(z.string().url()).max(10).default([]),
});

export const moveStatusSchema = z.object({
  id: z.string().uuid(),
  to_status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
export type TaskLink = z.infer<typeof taskLinkSchema>;
