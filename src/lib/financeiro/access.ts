/**
 * Acesso ao módulo /financeiro. FONTE ÚNICA — guarda das páginas + visibilidade
 * do item no menu. Substitui os `if (role !== "socio")` que estavam copiados em
 * cada subpágina.
 *
 * Cargos com acesso FULL (DRE/lucro, caixa, ranking, despesas): sócio e financeiro.
 * As telas operacionais de dinheiro (pagamentos, contratos) liberam também a ADM
 * — nesses call-sites soma-se `role === "adm"` além deste helper.
 */
export const FINANCEIRO_ROLES = ["socio", "financeiro"] as const;

export function canAccessFinanceiro(role: string): boolean {
  return (FINANCEIRO_ROLES as readonly string[]).includes(role);
}
