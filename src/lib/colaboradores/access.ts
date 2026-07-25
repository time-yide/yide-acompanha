/** Quem "gerencia" — vê a aba Colaboradores (dentro de Bastidores) e a
 *  visão de Produtividade. Fonte única pra o gate do nav/abas. */
export const COLAB_MANAGER_ROLES = ["adm", "socio", "coordenador", "audiovisual_chefe"] as const;

export function podeVerColaboradores(role: string): boolean {
  return (COLAB_MANAGER_ROLES as readonly string[]).includes(role);
}
