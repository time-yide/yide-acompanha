export const MARKETPLACES = [
  "mercado_livre",
  "shopee",
  "amazon",
  "magalu",
  "outro",
] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  magalu: "Magalu",
  outro: "Outro",
};

export function marketplaceLabel(m: string): string {
  return (MARKETPLACE_LABELS as Record<string, string>)[m] ?? m;
}

/**
 * Cor de destaque por marketplace. Classes Tailwind ESTÁTICAS (aparecem
 * literais aqui pro JIT enxergar). `bar` = faixa lateral; `pill` = badge.
 */
export interface MarketplaceStyle {
  bar: string;
  pill: string;
}

export const MARKETPLACE_COLORS: Record<Marketplace, MarketplaceStyle> = {
  mercado_livre: { bar: "bg-amber-400", pill: "border-amber-400/25 bg-amber-400/10 text-amber-500 dark:text-amber-400" },
  shopee: { bar: "bg-orange-500", pill: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  amazon: { bar: "bg-sky-400", pill: "border-sky-400/25 bg-sky-400/10 text-sky-600 dark:text-sky-400" },
  magalu: { bar: "bg-blue-500", pill: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  outro: { bar: "bg-zinc-400", pill: "border-zinc-400/25 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300" },
};

export function marketplaceStyle(m: string): MarketplaceStyle {
  return (MARKETPLACE_COLORS as Record<string, MarketplaceStyle>)[m] ?? MARKETPLACE_COLORS.outro;
}
