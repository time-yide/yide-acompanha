import { z } from "zod";
export * from "./constants";

const optionalText = z.string().trim().max(2000).optional().nullable();

const baseFields = {
  nome: z.string().trim().min(2, "Nome do curso é obrigatório").max(200),
  plataforma: z.string().trim().min(1, "Plataforma é obrigatória").max(100),
  link: z.union([z.string().url("Link inválido"), z.literal("")]).optional().nullable(),
  email_acesso: optionalText,
  senha_acesso: optionalText,
  descricao: optionalText,
};

export const createCursoExternoSchema = z.object(baseFields);
export const updateCursoExternoSchema = z.object({
  id: z.string().uuid(),
  ...baseFields,
});

export type CreateCursoExternoInput = z.infer<typeof createCursoExternoSchema>;
export type UpdateCursoExternoInput = z.infer<typeof updateCursoExternoSchema>;

export interface CursoExternoRow {
  id: string;
  nome: string;
  plataforma: string;
  link: string | null;
  email_acesso: string | null;
  senha_acesso: string | null;
  descricao: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
}
