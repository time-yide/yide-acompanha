import { z } from "zod";

export const EXPENSE_CATEGORIAS = [
  "aluguel",
  "software",
  "contabilidade",
  "impostos",
  "marketing_proprio",
  "equipamento",
  "pro_labore",
  "outros",
] as const;
export type ExpenseCategoria = (typeof EXPENSE_CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<ExpenseCategoria, string> = {
  aluguel: "Aluguel",
  software: "Software",
  contabilidade: "Contabilidade",
  impostos: "Impostos",
  marketing_proprio: "Marketing próprio",
  equipamento: "Equipamento",
  pro_labore: "Pró-labore",
  outros: "Outros",
};

export const EXPENSE_TIPOS = ["fixa", "avulsa"] as const;
export type ExpenseTipo = (typeof EXPENSE_TIPOS)[number];

const monthRegex = /^\d{4}-\d{2}$/;

const baseSchema = z.object({
  descricao: z.string().trim().min(2, "Descrição muito curta").max(200),
  categoria: z.enum(EXPENSE_CATEGORIAS),
  tipo: z.enum(EXPENSE_TIPOS),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo"),
  mes_referencia: z.string().regex(monthRegex).optional().nullable(),
  inicio_mes: z.string().regex(monthRegex).optional().nullable(),
  fim_mes: z.string().regex(monthRegex).optional().nullable(),
  notas: z.string().trim().max(1000).optional().nullable(),
});

export const createExpenseSchema = baseSchema.refine(
  (d) => d.tipo === "avulsa" ? !!d.mes_referencia : !d.mes_referencia,
  { message: "Avulsa exige mes_referencia; fixa não aceita.", path: ["mes_referencia"] },
).refine(
  (d) => d.tipo === "fixa" || (!d.inicio_mes && !d.fim_mes),
  { message: "inicio_mes/fim_mes só fazem sentido pra fixa.", path: ["inicio_mes"] },
).refine(
  (d) => !d.fim_mes || !d.inicio_mes || d.fim_mes > d.inicio_mes,
  { message: "fim_mes precisa ser maior que inicio_mes.", path: ["fim_mes"] },
);

export const updateExpenseSchema = baseSchema.extend({
  id: z.string().uuid(),
}).refine(
  (d) => d.tipo === "avulsa" ? !!d.mes_referencia : !d.mes_referencia,
  { message: "Avulsa exige mes_referencia; fixa não aceita.", path: ["mes_referencia"] },
).refine(
  (d) => d.tipo === "fixa" || (!d.inicio_mes && !d.fim_mes),
  { message: "inicio_mes/fim_mes só fazem sentido pra fixa.", path: ["inicio_mes"] },
).refine(
  (d) => !d.fim_mes || !d.inicio_mes || d.fim_mes > d.inicio_mes,
  { message: "fim_mes precisa ser maior que inicio_mes.", path: ["fim_mes"] },
);

export const overrideSchema = z.object({
  expense_id: z.string().uuid(),
  mes_referencia: z.string().regex(monthRegex),
  valor: z.coerce.number().min(0),
  motivo: z.string().trim().max(500).optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;

export const FINANCEIRO_CACHE_TAG = "financeiro";
