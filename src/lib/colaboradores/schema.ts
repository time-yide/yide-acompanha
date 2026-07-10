import { z } from "zod";

export const ROLES = [
  "adm",
  "socio",
  "comercial",
  "coordenador",
  "assessor",
  "videomaker",
  "designer",
  "editor",
  "audiovisual_chefe",
  "assessor_ecommerce",
  "assistente_ecommerce",
  "programacao",
] as const;
export type RoleEnum = typeof ROLES[number];

/** Especialidades de assessor. Só rótulo — não muda comissão/regras. */
export const ESPECIALIDADES = ["ecommerce"] as const;
export type EspecialidadeEnum = typeof ESPECIALIDADES[number];

/** Campo `especialidade` do form: "", null ou "comum" viram null; senão valida contra ESPECIALIDADES. */
const especialidadeField = z.preprocess(
  (v) => (v === "" || v == null || v === "comum" ? null : v),
  z.enum(ESPECIALIDADES).nullable(),
);

const PRODUCERS = ["videomaker", "designer", "editor"] as const;

function zeroPercentForProducers<T extends { role: string; comissao_percent: number; comissao_primeiro_mes_percent: number }>(
  data: T,
): T {
  if ((PRODUCERS as readonly string[]).includes(data.role)) {
    return { ...data, comissao_percent: 0, comissao_primeiro_mes_percent: 0 };
  }
  return data;
}

/** Especialidade só faz sentido pra assessor — zera pra qualquer outro role. */
function clearEspecialidadeForNonAssessor<T extends { role: string; especialidade?: EspecialidadeEnum | null }>(
  data: T,
): T {
  if (data.role !== "assessor" && data.especialidade != null) {
    return { ...data, especialidade: null };
  }
  return data;
}

function normalizeColaborador<T extends {
  role: string;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
  especialidade?: EspecialidadeEnum | null;
}>(data: T): T {
  return clearEspecialidadeForNonAssessor(zeroPercentForProducers(data));
}

export const createColaboradorSchema = z
  .object({
    nome: z.string().min(2, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    role: z.enum(ROLES),
    fixo_mensal: z.coerce.number().min(0).default(0),
    comissao_percent: z.coerce.number().min(0).max(100).default(0),
    comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100).default(0),
    especialidade: especialidadeField.default(null),
  })
  .transform(normalizeColaborador);

export const editColaboradorSchema = z
  .object({
    id: z.string().uuid(),
    nome: z.string().min(2),
    telefone: z.string().optional().nullable(),
    endereco: z.string().optional().nullable(),
    pix: z.string().optional().nullable(),
    data_nascimento: z.string().optional().nullable(),
    data_admissao: z.string().optional().nullable(),
    fixo_mensal: z.coerce.number().min(0),
    comissao_percent: z.coerce.number().min(0).max(100),
    comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100),
    role: z.enum(ROLES),
    ativo: z.coerce.boolean(),
    especialidade: especialidadeField.default(null),
    justificativa: z.string().optional(),
    // Metas comerciais (opcionais, só relevantes para role='comercial')
    meta_prospects_mes: z.coerce.number().int().min(0).optional().nullable(),
    meta_fechamentos_mes: z.coerce.number().int().min(0).optional().nullable(),
    meta_receita_mes: z.coerce.number().min(0).optional().nullable(),
  })
  .transform(normalizeColaborador);

export type CreateColaboradorInput = z.infer<typeof createColaboradorSchema>;
export type EditColaboradorInput = z.infer<typeof editColaboradorSchema>;
