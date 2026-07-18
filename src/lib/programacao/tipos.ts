export const TIPOS_PROGRAMACAO = ["crm_conectado", "usuario_criado", "sistema_feito"] as const;
export type TipoProgramacao = (typeof TIPOS_PROGRAMACAO)[number];

export const TIPO_LABELS: Record<TipoProgramacao, string> = {
  crm_conectado: "CRM conectado",
  usuario_criado: "Usuário criado",
  sistema_feito: "Sistema feito",
};

export function tipoLabel(t: string): string {
  return (TIPO_LABELS as Record<string, string>)[t] ?? t;
}
