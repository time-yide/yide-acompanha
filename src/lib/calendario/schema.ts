import { z } from "zod";

export const SUB_CALENDARS = [
  "agencia",
  "onboarding",
  "aniversarios",
  "videomakers",
  "assessores",
  "coordenadores",
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
  localizacao_endereco: z.string().optional().nullable(),
  localizacao_maps_url: z.string().optional().nullable(),
  link_roteiro: z.string().optional().nullable(),
  observacoes_gravacao: z.string().optional().nullable(),
};

// Por enquanto todos os campos do bloco videomaker são opcionais. Quem cria
// preenche o que tiver; videomaker complementa depois pela tela de detalhe.
export const createEventSchema = z.object(baseEventFields);
export const editEventSchema = z.object({ ...baseEventFields, id: z.string().uuid() });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EditEventInput = z.infer<typeof editEventSchema>;

export interface CalendarEvent {
  id: string;
  origem: "manual" | "lead_prospeccao" | "lead_marco_zero" | "client_birthday" | "colab_birthday" | "client_date";
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string;
  sub_calendar: SubCalendar;
  link?: string;
  cor?: string;
  localizacao_endereco?: string | null;
  localizacao_maps_url?: string | null;
  link_roteiro?: string | null;
  observacoes_gravacao?: string | null;
  criado_por?: string;
  participantes_ids?: string[];
  /** Fluxo de delegação de captação (só relevante pra sub_calendar=videomakers). */
  videomaker_status?: "pending_delegation" | "scheduled" | "completed" | "cancelled" | null;
  /** Videomaker designado pelo coord (null enquanto pending). */
  videomaker_assigned_id?: string | null;
}
