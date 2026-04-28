import { z } from "zod";

export const ATTEMPT_CHANNELS = ["whatsapp", "email", "ligacao", "presencial", "outro"] as const;
export const ATTEMPT_RESULTS = ["sem_resposta", "agendou", "recusou", "pediu_proposta", "outro"] as const;

export const agendarReuniaoSchema = z.object({
  lead_id: z.string().uuid(),
  tipo: z.enum(["prospeccao_agendada", "marco_zero"]),
  data_hora: z.string().min(1, "Data obrigatória"),
  descricao: z.string().optional().nullable(),
});

export const marcarPerdidoSchema = z.object({
  lead_id: z.string().uuid(),
  motivo: z.string().min(3, "Motivo muito curto").max(2000),
});

export const addAttemptSchema = z.object({
  lead_id: z.string().uuid(),
  canal: z.enum(ATTEMPT_CHANNELS),
  resultado: z.enum(ATTEMPT_RESULTS),
  observacao: z.string().optional().nullable(),
  proximo_passo: z.string().optional().nullable(),
  data_proximo_passo: z.string().optional().nullable(),
});

export type AgendarReuniaoInput = z.infer<typeof agendarReuniaoSchema>;
export type MarcarPerdidoInput = z.infer<typeof marcarPerdidoSchema>;
export type AddAttemptInput = z.infer<typeof addAttemptSchema>;
