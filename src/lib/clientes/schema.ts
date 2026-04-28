import { z } from "zod";

export const STATUSES = ["ativo", "churn", "em_onboarding"] as const;

export const createClienteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_mensal: z.coerce.number().min(0).default(0),
  servico_contratado: z.string().optional().nullable(),
  data_entrada: z.string().optional(),
  assessor_id: z.string().uuid().optional().nullable(),
  coordenador_id: z.string().uuid().optional().nullable(),
  data_aniversario_socio_cliente: z.string().optional().nullable(),
});

export const editClienteSchema = createClienteSchema.extend({
  id: z.string().uuid(),
  designer_id: z.string().min(1).optional().nullable(),
  videomaker_id: z.string().min(1).optional().nullable(),
  editor_id: z.string().min(1).optional().nullable(),
  instagram_url: z.string().url().or(z.literal("")).optional().nullable(),
  gmn_url: z.string().url().or(z.literal("")).optional().nullable(),
  drive_url: z.string().url().or(z.literal("")).optional().nullable(),
  pacote_post_padrao: z.coerce.number().int().min(0).optional().nullable(),
});

export const churnClienteSchema = z.object({
  id: z.string().uuid(),
  motivo_churn: z.string().min(3, "Informe o motivo do churn"),
  data_churn: z.string().optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type EditClienteInput = z.infer<typeof editClienteSchema>;
export type ChurnClienteInput = z.infer<typeof churnClienteSchema>;
