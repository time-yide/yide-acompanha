import { z } from "zod";

export const ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;
export type RoleEnum = typeof ROLES[number];

export const inviteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  role: z.enum(ROLES),
  fixo_mensal: z.coerce.number().min(0).default(0),
  comissao_percent: z.coerce.number().min(0).max(100).default(0),
  comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100).default(0),
});

export const editColaboradorSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  pix: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  data_admissao: z.string().optional().nullable(),
  fixo_mensal: z.coerce.number().min(0),
  comissao_percent: z.coerce.number().min(0).max(100),
  comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100),
  role: z.enum(ROLES),
  ativo: z.coerce.boolean(),
  justificativa: z.string().optional(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type EditColaboradorInput = z.infer<typeof editColaboradorSchema>;
