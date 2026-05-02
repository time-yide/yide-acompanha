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
  localizacao_endereco: z.string().optional().nullable(),
  localizacao_maps_url: z.string().optional().nullable(),
  link_roteiro: z.string().optional().nullable(),
  observacoes_gravacao: z.string().optional().nullable(),
};

function videomakerRefinement<T extends {
  sub_calendar: SelectableSub;
  localizacao_endereco?: string | null;
  localizacao_maps_url?: string | null;
  link_roteiro?: string | null;
}>(schema: z.ZodType<T>) {
  return schema.superRefine((val, ctx) => {
    if (val.sub_calendar !== "videomakers") return;
    if (!val.localizacao_endereco?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localizacao_endereco"], message: "Localização (endereço) é obrigatória para videomaker" });
    }
    if (!val.localizacao_maps_url?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localizacao_maps_url"], message: "Link do Google Maps é obrigatório para videomaker" });
    }
    if (!val.link_roteiro?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["link_roteiro"], message: "Link do roteiro é obrigatório para videomaker" });
    }
  });
}

export const createEventSchema = videomakerRefinement(z.object(baseEventFields));
export const editEventSchema = videomakerRefinement(z.object({ ...baseEventFields, id: z.string().uuid() }));

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
}
