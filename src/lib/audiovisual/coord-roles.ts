// Constants compartilhadas entre actions e UI. Arquivo separado de
// coord-actions.ts porque "use server" só permite async exports.
//
// Decisão Yasmin: sócio VÊ a fila de coordenação read-only (acompanha
// operação) mas NÃO delega — quem delega é o audiovisual_chefe (com
// adm como fallback admin).

/** Roles autorizados a DELEGAR captação pra videomaker. */
export const ROLES_COORD_DELEGATE: ReadonlySet<string> = new Set([
  "audiovisual_chefe",
  "adm",
]);

/** Roles autorizados a VER a fila de captações pendentes (read-only inclui sócio). */
export const ROLES_COORD_VIEW: ReadonlySet<string> = new Set([
  "audiovisual_chefe",
  "adm",
  "socio",
]);

export function canRoleDelegateVideomaker(role: string): boolean {
  return ROLES_COORD_DELEGATE.has(role);
}

export function canRoleViewCoord(role: string): boolean {
  return ROLES_COORD_VIEW.has(role);
}
