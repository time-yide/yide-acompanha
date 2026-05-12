import { z } from "zod";
import { STATUS_LEAD_VALORES } from "./tipos";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

export const criarPesquisaSchema = z.object({
  nicho: z.string().trim().min(2, "Nicho muito curto").max(120),
  cidade: z.string().trim().min(2, "Cidade muito curta").max(120),
  limite: z.coerce.number().int().min(1).max(500).default(20),
});

export const updateLeadSchema = z.object({
  id: uuidLike,
  status: z.enum(STATUS_LEAD_VALORES).optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  // Campos editáveis manualmente (caso o usuário queira corrigir info do Outscraper)
  empresa: z.string().trim().min(2).max(200).optional(),
  telefone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).email().or(z.literal("")).optional().nullable(),
  website: z.string().trim().max(500).url().or(z.literal("")).optional().nullable(),
  instagram: z.string().trim().max(80).optional().nullable(),
  decisor_nome: z.string().trim().max(200).optional().nullable(),
  decisor_cargo: z.string().trim().max(120).optional().nullable(),
  decisor_email: z.string().trim().max(200).email().or(z.literal("")).optional().nullable(),
});

export const archiveLeadSchema = z.object({ id: uuidLike });

export const changeLeadStatusSchema = z.object({
  id: uuidLike,
  status: z.enum(STATUS_LEAD_VALORES),
});

export type CriarPesquisaInput = z.infer<typeof criarPesquisaSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
