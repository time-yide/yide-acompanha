import { z } from "zod";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID invalido",
);

export const criarVisitaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  titulo: z.string().trim().min(2).max(160),
  bairro: z.string().trim().max(120).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const updateVisitaSchema = criarVisitaSchema.extend({ id: uuidLike });
export const arquivarVisitaSchema = z.object({ id: uuidLike });

export const adicionarLeadVisitaSchema = z.object({
  visita_id: uuidLike,
  empresa: z.string().trim().min(2).max(200),
  telefone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  contato: z.string().trim().max(200).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export type CriarVisitaInput = z.infer<typeof criarVisitaSchema>;
export type AdicionarLeadVisitaInput = z.infer<typeof adicionarLeadVisitaSchema>;
