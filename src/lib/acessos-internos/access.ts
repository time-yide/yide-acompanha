/** Gestão dos acessos internos: cria/edita/apaga e vê os "restritos".
 *  O time todo só vê os marcados como visibility='time'. */
export const ACESSOS_MANAGER_ROLES = ["adm", "socio", "coordenador"] as const;

export function podeGerenciarAcessosInternos(role: string): boolean {
  return (ACESSOS_MANAGER_ROLES as readonly string[]).includes(role);
}
