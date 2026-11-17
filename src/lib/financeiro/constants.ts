// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

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

export const BULK_DELETE_MAX = 50;
