import { z } from "zod";
import { TIPOS_PROGRAMACAO } from "./tipos";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarLancamentoSchema = z.object({
  client_id: uuidLike,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  tipo: z.enum(TIPOS_PROGRAMACAO),
  quantidade: z.coerce.number().int().min(1, "Quantidade deve ser ≥ 1").max(100000),
  observacao: z.string().trim().max(2000).optional().nullable(),
});

export const updateLancamentoSchema = criarLancamentoSchema.extend({ id: uuidLike });
export const arquivarLancamentoSchema = z.object({ id: uuidLike });
