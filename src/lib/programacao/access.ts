/**
 * Acesso ao módulo /programacao. FONTE ÚNICA — guarda da página + visibilidade
 * do item no menu. Cargos: adm, sócio, programacao.
 */
export const PROGRAMACAO_ROLES = ["adm", "socio", "programacao"] as const;

export function canAccessProgramacao(role: string): boolean {
  return (PROGRAMACAO_ROLES as readonly string[]).includes(role);
}
