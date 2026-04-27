import { z } from "zod";
import { localIsoDate } from "@/lib/utils/date";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = ["aberta", "em_andamento", "concluida"] as const;

const todayIso = () => localIsoDate();

export const createTaskSchema = z.object({
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) => !v || v >= todayIso(),
      "Prazo não pode estar no passado",
    ),
});

export const editTaskSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(2, "Título muito curto").max(200, "Título muito longo"),
  descricao: z.string().max(4000, "Descrição muito longa").optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(), // sem restrição de futuro em edit
  status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
