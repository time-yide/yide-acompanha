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
