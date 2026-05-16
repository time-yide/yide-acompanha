import { z } from "zod";
import type { Role } from "@/lib/auth/permissions";

export interface Unit {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  endereco: string | null;
  cnpj: string | null;
  cor_destaque: string | null;
}

/** Roles que podem operar em QUALQUER unidade (master). Demais roles ficam
 *  travados na própria unidade. Decisão produto: apenas adm/sócio. */
export const MASTER_ROLES: readonly Role[] = ["adm", "socio"];

export function isMasterRole(role: Role): boolean {
  return (MASTER_ROLES as readonly string[]).includes(role);
}

export const createUnitSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Apenas minúsculas, números e hífen"),
  endereco: z.string().trim().max(200).optional().nullable(),
  cnpj: z.string().trim().max(20).optional().nullable(),
  cor_destaque: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use formato #rrggbb")
    .optional()
    .nullable(),
  ativa: z.coerce.boolean().optional().default(true),
});

export const editUnitSchema = createUnitSchema.extend({
  id: z.string().uuid(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type EditUnitInput = z.infer<typeof editUnitSchema>;

/** Cookie que persiste a unidade "ativa" do usuário master entre páginas.
 *  Para non-master users, o cookie é ignorado (sempre usa profile.unit_id). */
export const ACTIVE_UNIT_COOKIE = "yide_active_unit";
