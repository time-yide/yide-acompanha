import { z } from "zod";
import { STATUS_LIGACAO, TIPOS_LIGACAO, DIRECOES } from "./tipos";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

export const updateLigacaoSchema = z.object({
  id: uuidLike,
  observacoes: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  contato_nome: z.string().trim().max(200).optional().nullable(),
});

export const archiveLigacaoSchema = z.object({ id: uuidLike });

export const popularMockSchema = z.object({
  quantidade: z.coerce.number().int().min(10).max(500).default(100),
});

export const createLigacaoSchema = z.object({
  tipo: z.enum(TIPOS_LIGACAO),
  numero: z.string().trim().min(8).max(40),
  contato_nome: z.string().trim().max(200).optional().nullable(),
  direcao: z.enum(DIRECOES).default("saida"),
  status: z.enum(STATUS_LIGACAO),
  iniciada_em: z.string(),
  duracao_segundos: z.coerce.number().int().min(0).default(0),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  lead_gerado_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
});

export const iniciarLigacaoSchema = z.object({
  numero: z.string().trim().min(8).max(40),
  instancia_id: z.string().regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Instância inválida",
  ),
  contato_nome: z.string().trim().max(200).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  lead_gerado_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  gravar: z.coerce.boolean().default(false),
});
export type IniciarLigacaoInput = z.infer<typeof iniciarLigacaoSchema>;

export type UpdateLigacaoInput = z.infer<typeof updateLigacaoSchema>;
export type CreateLigacaoInput = z.infer<typeof createLigacaoSchema>;
