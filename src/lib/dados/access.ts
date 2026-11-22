/**
 * Acesso ao painel /dados. FONTE ÚNICA — página, menu e actions.
 * Chefia + programação veem todos os clientes; assessor só a própria carteira.
 */
export const DADOS_TODOS_ROLES = ["adm", "socio", "programacao"] as const;
export const DADOS_ROLES = [...DADOS_TODOS_ROLES, "assessor"] as const;

export function canAccessDados(role: string): boolean {
  return (DADOS_ROLES as readonly string[]).includes(role);
}
export function dadosVeTodos(role: string): boolean {
  return (DADOS_TODOS_ROLES as readonly string[]).includes(role);
}
export function podeEditarConexoes(role: string): boolean {
  return dadosVeTodos(role);
}
