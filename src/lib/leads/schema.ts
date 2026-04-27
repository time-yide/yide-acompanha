import { z } from "zod";

export const STAGES = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"] as const;
export const PRIORITIES = ["alta", "media", "baixa"] as const;
export type Stage = typeof STAGES[number];

export const createLeadSchema = z.object({
  nome_prospect: z.string().min(2, "Nome do prospect muito curto"),
  site: z.string().url("Site inválido").optional().or(z.literal("")).nullable(),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_proposto: z.coerce.number().min(0).default(0),
  duracao_meses: z.coerce.number().int().min(0).optional().nullable(),
  servico_proposto: z.string().optional().nullable(),
  info_briefing: z.string().optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  data_prospeccao_agendada: z.string().optional().nullable(),
});

export const editLeadSchema = createLeadSchema.extend({
  id: z.string().uuid(),
  data_reuniao_marco_zero: z.string().optional().nullable(),
  coord_alocado_id: z.string().uuid().optional().nullable(),
  assessor_alocado_id: z.string().uuid().optional().nullable(),
});

export const moveStageSchema = z.object({
  id: z.string().uuid(),
  to_stage: z.enum(STAGES),
  observacao: z.string().optional(),
});

export const markLostSchema = z.object({
  id: z.string().uuid(),
  motivo_perdido: z.string().min(3, "Informe o motivo"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type EditLeadInput = z.infer<typeof editLeadSchema>;
