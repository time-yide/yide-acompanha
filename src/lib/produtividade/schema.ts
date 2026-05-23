import { z } from "zod";

export const EVENT_TYPES = [
  "login",
  "tarefa_criada",
  "tarefa_status_alterado",
  "tarefa_concluida",
  "tarefa_alteracao",
  "cliente_criado",
  "cliente_editado",
  "reuniao_criada",
  "reuniao_concluida",
  "ligacao_registrada",
  "lead_criado",
  "lead_movido",
  "apresentacao_criada",
  "comentario",
  "arte_criada",
  "arte_aprovada",
  "captura_criada",
  "captura_concluida",
  "post_criado",
  "post_aprovado",
  "solicitacao_respondida",
  "pageview",
  "outro",
] as const;

export type EventType = typeof EVENT_TYPES[number];

export const EVENT_LABEL: Record<EventType, string> = {
  login: "Login",
  tarefa_criada: "Tarefa criada",
  tarefa_status_alterado: "Status de tarefa alterado",
  tarefa_concluida: "Tarefa concluída",
  tarefa_alteracao: "Pedido de alteração",
  cliente_criado: "Cliente criado",
  cliente_editado: "Cliente editado",
  reuniao_criada: "Reunião criada",
  reuniao_concluida: "Reunião concluída",
  ligacao_registrada: "Ligação registrada",
  lead_criado: "Lead criado",
  lead_movido: "Lead movido no kanban",
  apresentacao_criada: "Apresentação criada",
  comentario: "Comentário",
  arte_criada: "Arte criada",
  arte_aprovada: "Arte aprovada",
  captura_criada: "Captura agendada",
  captura_concluida: "Captura concluída",
  post_criado: "Post criado",
  post_aprovado: "Post aprovado",
  solicitacao_respondida: "Solicitação respondida",
  pageview: "Navegação",
  outro: "Outro",
};

export const logEventSchema = z.object({
  event_type: z.enum(EVENT_TYPES),
  entity_type: z.string().max(64).optional().nullable(),
  entity_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogEventInput = z.infer<typeof logEventSchema>;

/** Horas úteis padrão por mês (22 dias × 8h). Usado pra calcular custo/hora. */
export const HORAS_UTEIS_MES = 176;

/** Janela considerada "online" - heartbeat há menos disso. */
export const ONLINE_WINDOW_SECONDS = 120;

/** Janela considerada "ativo" - evento real há menos disso. */
export const ATIVO_WINDOW_SECONDS = 300;

/** Janela contínua de eventos pra contar como mesma "sessão" - 10 min de
 *  inatividade encerra a sessão. */
export const SESSAO_GAP_SECONDS = 600;
