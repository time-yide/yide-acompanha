import { z } from "zod";
import { STATUS_OP, TIPO_OP } from "./tipos";

const uuid = z.string().uuid();

export const criarOportunidadeSchema = z.object({
  titulo: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(2000).optional().nullable(),
  cliente_nome: z.string().trim().max(160).optional().nullable(),
  contato: z.string().trim().max(160).optional().nullable(),
  horario: z.string().trim().max(120).optional().nullable(),
  valor_comissao: z.coerce.number().min(0).max(1_000_000),
  tipo: z.enum(TIPO_OP).default("captacao"),
  entrega_urgente: z.coerce.boolean().default(false),
  prazo_entrega: z.string().trim().max(40).optional().nullable(),
});

export const moverStatusSchema = z.object({
  id: uuid,
  status: z.enum(STATUS_OP),
});

export const definirMetaSchema = z.object({
  descricao: z.string().trim().min(2).max(200),
  tipo_alvo: z.enum(["pontos", "fechamentos", "comissao"]),
  alvo: z.coerce.number().min(0).max(10_000_000),
  bonus_descricao: z.string().trim().max(300).optional().nullable(),
});

/**
 * Urgência só vale para o tipo "edicao". Para qualquer outro tipo, zera
 * `entrega_urgente` e `prazo_entrega` no servidor (não confiar só no front).
 */
export function normalizeUrgencia(
  tipo: string,
  entrega_urgente: boolean,
  prazo_entrega: string | null,
): { entrega_urgente: boolean; prazo_entrega: string | null } {
  if (tipo !== "edicao") return { entrega_urgente: false, prazo_entrega: null };
  return {
    entrega_urgente: !!entrega_urgente,
    prazo_entrega: entrega_urgente ? (prazo_entrega ?? null) : null,
  };
}

export type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;
