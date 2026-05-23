import { z } from "zod";

export const CATEGORIAS = ["alteracao", "trafego", "reuniao", "duvida", "outro"] as const;
export type Categoria = typeof CATEGORIAS[number];

export const STATUSES = ["aberta", "em_andamento", "concluida", "cancelada"] as const;
export type Status = typeof STATUSES[number];

export const PRIORIDADES = ["normal", "urgente"] as const;
export type Prioridade = typeof PRIORIDADES[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  alteracao: "Alteração em arte/vídeo",
  trafego: "Pedido de tráfego",
  reuniao: "Reunião / estratégia",
  duvida: "Dúvida geral",
  outro: "Outro",
};

export const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  normal: "Normal",
  urgente: "Urgente",
};

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
