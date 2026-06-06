// Papéis que podem acessar/gerenciar o módulo Design (espelha ALLOWED_ROLES de
// src/app/(authed)/design/page.tsx — quem consegue abrir o módulo).
export const DESIGN_ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
] as const;

export function isDesignRole(role: string): boolean {
  return (DESIGN_ROLES as readonly string[]).includes(role);
}
