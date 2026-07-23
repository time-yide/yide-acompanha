import { z } from "zod";
import { clienteObrigatorio } from "./reuniao-gravacao";

export const SUB_CALENDARS = [
  "agencia",
  "onboarding",
  "aniversarios",
  "videomakers",
  "assessores",
  "coordenadores",
  "programacao",
  "comercial",
] as const;
export type SubCalendar = typeof SUB_CALENDARS[number];

// Sub-calendars que o usuário pode escolher ao criar um evento manual.
// 'aniversarios' é gerado automaticamente a partir de profiles/clients, então
// ficou de fora pra evitar duplicação.
export const SELECTABLE_SUBS = [
  "agencia",
  "videomakers",
  "assessores",
  "coordenadores",
  "programacao",
  "comercial",
] as const;
export type SelectableSub = typeof SELECTABLE_SUBS[number];

// Papéis autorizados a criar evento de videomaker (quem agenda a gravação).
export const ROLES_PODEM_CRIAR_VIDEOMAKER = ["socio", "adm", "coordenador", "assessor"] as const;

const baseEventFields = {
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  inicio: z.string().min(8, "Data/hora de início inválida"),
  fim: z.string().min(8, "Data/hora de fim inválida"),
  participantes_ids: z.array(z.string().uuid()).default([]),
  sub_calendar: z.enum(SELECTABLE_SUBS).default("agencia"),
  client_id: z.string().uuid().optional().nullable(),
  // Cliente avulso (texto livre) quando não está cadastrado. Mutuamente
  // exclusivo com client_id no form; não entra nas contagens do painel.
  cliente_avulso: z.string().trim().max(120).optional().nullable(),
  localizacao_endereco: z.string().optional().nullable(),
  localizacao_maps_url: z.string().optional().nullable(),
  link_roteiro: z.string().optional().nullable(),
  roteiro_tipo: z.enum(["link", "pdf"]).optional().nullable(),
  roteiro_pdf_path: z.string().optional().nullable(),
  observacoes_gravacao: z.string().optional().nullable(),
  videomaker_assigned_id: z.string().uuid().optional().nullable(),
};

// O videomaker responsável é opcional no schema — a obrigatoriedade depende do
// papel de quem cria (só o coordenador audiovisual é obrigado) e é validada na
// server action, que conhece o role do ator.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refineClienteObrigatorio(data: any, ctx: z.RefinementCtx) {
  if (clienteObrigatorio(data.sub_calendar) && !data.client_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["client_id"], message: "Selecione o cliente desta reunião" });
  }
}

export const createEventSchema = z.object(baseEventFields).superRefine(refineClienteObrigatorio);
export const editEventSchema = z.object({ ...baseEventFields, id: z.string().uuid() }).superRefine(refineClienteObrigatorio);

/**
 * Garante que o videomaker designado esteja em participantes_ids (sem
 * duplicar) — pra agenda/notificação dele funcionarem. Retorna a lista
 * intacta quando não há videomaker.
 */
export function comParticipanteVideomaker(
  participantes: string[],
  videomakerId: string | null | undefined,
): string[] {
  if (!videomakerId) return participantes;
  return participantes.includes(videomakerId)
    ? participantes
    : [...participantes, videomakerId];
}

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EditEventInput = z.infer<typeof editEventSchema>;

export interface CalendarEvent {
  id: string;
  origem: "manual" | "lead_prospeccao" | "lead_marco_zero" | "client_birthday" | "colab_birthday" | "client_date" | "bloqueio_agenda" | "freela";
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  sub_calendar: SubCalendar;
  link?: string | null;
  cor?: string;
  localizacao_endereco?: string | null;
  localizacao_maps_url?: string | null;
  link_roteiro?: string | null;
  roteiro_tipo?: "link" | "pdf" | null;
  roteiro_pdf_path?: string | null;
  observacoes_gravacao?: string | null;
  criado_por?: string;
  participantes_ids?: string[];
  /** Fluxo de delegação de captação (só relevante pra sub_calendar=videomakers). */
  videomaker_status?: "pending_delegation" | "scheduled" | "completed" | "cancelled" | null;
  /** Videomaker designado pelo coord (null enquanto pending). */
  videomaker_assigned_id?: string | null;
  /** Nome do videomaker designado, resolvido em listEventsForWeek pra exibir no card. */
  videomaker_assigned_nome?: string | null;
  /** Quando o videomaker marcou que leu o roteiro. */
  videomaker_leu_em?: string | null;
  /** Quando o videomaker marcou que imprimiu o roteiro. */
  videomaker_imprimiu_em?: string | null;
  /** Marca de indisponibilidade (bloqueio de agenda aprovado). Read-only, sem link. */
  bloqueio?: {
    /** Nome do videomaker que ficou indisponível. */
    videomaker_nome: string;
    /** HH:MM (fuso da app). */
    hora_inicio: string;
    /** HH:MM (fuso da app). */
    hora_fim: string;
    /** Motivo informado na solicitação. */
    motivo: string;
  };
  /** Oportunidade do FreelaYide reservada na agenda de quem pegou. Read-only,
   * renderizado por ramo dedicado no EventCell/MonthView (cor esmeralda). */
  freela?: {
    /** disponivel|pega|em_negociacao|fechada|perdida (string livre pra não
     * acoplar o tipo do calendário ao do FreelaYide). */
    status: string;
    /** captacao|modelo|edicao. */
    tipo: string;
    valor_comissao: number;
    /** true = edição urgente (mostra pontinho laranja). */
    urgente: boolean;
    /** true quando o freela é de OUTRA pessoa (renderiza como "Indisponível", sem detalhe). */
    reservadoDeOutro?: boolean;
    /** nome de quem reservou (usado quando reservadoDeOutro). */
    dono_nome?: string | null;
  };
}
