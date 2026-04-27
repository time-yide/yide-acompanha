import { z } from "zod";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = ["aberta", "em_andamento", "concluida"] as const;

export const createTaskSchema = z.object({
  titulo: z.string().min(3, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const editTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
