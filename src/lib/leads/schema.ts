import { z } from "zod";
import { STAGES, PRIORITIES } from "./constants";
export * from "./constants";

export const createLeadSchema = z.object({
  nome_prospect: z.string().min(2, "Nome do prospect muito curto"),
  site: z.string().url("Site inválido").optional().or(z.literal("")).nullable(),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_proposto: z.coerce.number().min(0).default(0),
  duracao_meses: z.coerce.number().int().min(0).optional().nullable(),
  servico_proposto: z.string().optional().nullable(),
  link_proposta: z.string().url("Link inválido").optional().or(z.literal("")).nullable(),
  info_briefing: z.string().optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  data_prospeccao_agendada: z.string().optional().nullable(),
  canal: z.enum(["ligacao", "rua"]).default("ligacao"),
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

export const deleteLeadSchema = z.object({
  id: z.string().uuid(),
  justificativa: z.string().min(3, "Informe o motivo (mín. 3 caracteres)"),
});

/**
 * Estágios em que faz sentido importar um cliente existente. Os pré-contrato
 * (leads_potencial, leads_ativos, reuniao_comercial, proposta_enviada) não
 * cabem porque o cliente já está em `clients` - ou seja, contrato já foi
 * assinado. Marco_zero/ativo permitem completar processos pendentes do
 * onboarding sem duplicar cadastro.
 */
export const STAGES_IMPORT_ELEGIVEIS = ["contrato", "marco_zero"] as const;
export type StageImportElegivel = typeof STAGES_IMPORT_ELEGIVEIS[number];

export const importClientToOnboardingSchema = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  to_stage: z.enum(STAGES_IMPORT_ELEGIVEIS),
  servico_proposto: z.string().optional().nullable(),
  info_briefing: z.string().optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type EditLeadInput = z.infer<typeof editLeadSchema>;
