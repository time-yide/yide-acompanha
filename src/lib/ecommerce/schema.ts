import { z } from "zod";
import { MARKETPLACES } from "./marketplaces";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarAnuncioSchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  quantidade: z.coerce.number().int().min(1, "Quantidade deve ser ≥ 1").max(100000),
  marketplace: z.enum(MARKETPLACES),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

export const updateAnuncioSchema = criarAnuncioSchema.extend({ id: uuidLike });
export const arquivarAnuncioSchema = z.object({ id: uuidLike });

export type CriarAnuncioInput = z.infer<typeof criarAnuncioSchema>;
