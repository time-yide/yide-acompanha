import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().nullable();

const baseFields = {
  nome: z.string().trim().min(1, "Nome da unidade é obrigatório").max(200),
  endereco: optionalText,
  drive_url: z.union([z.string().url("URL do Drive inválida"), z.literal("")]).optional().nullable(),
  observacoes: optionalText,
};

export const createUnidadeSchema = z.object({
  client_id: z.string().uuid(),
  ...baseFields,
});

export const updateUnidadeSchema = z.object({
  id: z.string().uuid(),
  ...baseFields,
});

export type CreateUnidadeInput = z.infer<typeof createUnidadeSchema>;
export type UpdateUnidadeInput = z.infer<typeof updateUnidadeSchema>;

export interface ClientUnitRow {
  id: string;
  client_id: string;
  nome: string;
  endereco: string | null;
  drive_url: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}
