/**
 * Regra de acesso ao módulo /ecommerce. FONTE ÚNICA — usada pela guarda da
 * página (server) e pela visibilidade do item no menu (client).
 *
 * Quem acessa:
 * - Cargos dedicados: adm, sócio, assessor de e-commerce, assistente de e-commerce.
 * - Assessor COMUM com especialidade "ecommerce": mantém o cargo `assessor`
 *   (com comissão e carteira normais), mas também toca e-commerce — ex: o Felipe.
 *   Isso evita rebaixar o cargo dele (assessor_ecommerce não recebe comissão) e
 *   NÃO abre o módulo pra todos os assessores, só pros marcados como e-commerce.
 */
export const ECOMMERCE_ROLES = ["adm", "socio", "assessor_ecommerce", "assistente_ecommerce"] as const;

export function canAccessEcommerce(role: string, especialidade?: string | null): boolean {
  if ((ECOMMERCE_ROLES as readonly string[]).includes(role)) return true;
  return role === "assessor" && especialidade === "ecommerce";
}
