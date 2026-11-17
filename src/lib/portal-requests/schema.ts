import { z } from "zod";
import { CATEGORIAS, STATUSES, PRIORIDADES, type Categoria, type Status, type Prioridade } from "./constants";
export * from "./constants";

export const createRequestSchema = z.object({
  titulo: z.string().trim().min(3, "Título muito curto").max(200),
  descricao: z.string().trim().min(10, "Descreva melhor sua solicitação").max(5000),
  categoria: z.enum(CATEGORIAS),
  prioridade: z.enum(PRIORIDADES).default("normal"),
});

export const respondRequestSchema = z.object({
  id: z.string().uuid(),
  resposta: z.string().trim().min(1, "Escreva a resposta").max(5000),
  /** Novo status - só "em_andamento" ou "concluida" são opções pelo flow normal. */
  to_status: z.enum(["em_andamento", "concluida"]),
});

export const changeStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type RespondRequestInput = z.infer<typeof respondRequestSchema>;

export interface RequestRow {
  id: string;
  client_id: string;
  created_by_user_id: string | null;
  created_by_nome: string | null;
  titulo: string;
  descricao: string;
  categoria: Categoria;
  status: Status;
  prioridade: Prioridade;
  resposta: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
}
