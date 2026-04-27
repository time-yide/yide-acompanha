import { z } from "zod";

export const SUB_CALENDARS = ["agencia", "onboarding", "aniversarios"] as const;
export type SubCalendar = typeof SUB_CALENDARS[number];

export const createEventSchema = z.object({
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  inicio: z.string().min(8, "Data/hora de início inválida"),
  fim: z.string().min(8, "Data/hora de fim inválida"),
  participantes_ids: z.array(z.string().uuid()).default([]),
});

export const editEventSchema = createEventSchema.extend({
  id: z.string().uuid(),
});

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
}
