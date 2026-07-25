import { z } from "zod";

export const INTERNAL_VISIBILITY = ["time", "restrito"] as const;
export type InternalVisibility = (typeof INTERNAL_VISIBILITY)[number];

export const acessoInternoSchema = z.object({
  service_name: z.string().trim().min(1, "Nome do sistema é obrigatório").max(120),
  username: z.string().trim().max(200).optional().nullable(),
  password: z.string().min(1, "Senha é obrigatória"),
  notes: z.string().trim().max(2000).optional().nullable(),
  visibility: z.enum(INTERNAL_VISIBILITY).default("restrito"),
});

export const editAcessoInternoSchema = acessoInternoSchema.extend({
  id: z.string().uuid(),
  // Senha opcional na edição: ausente = mantém a atual.
  password: z.string().min(1).optional(),
});

export type AcessoInternoInput = z.infer<typeof acessoInternoSchema>;
