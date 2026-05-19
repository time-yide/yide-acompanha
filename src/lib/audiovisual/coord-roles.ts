// Constants compartilhadas entre actions e UI. Arquivo separado de
// coord-actions.ts porque "use server" só permite async exports.

/** Roles autorizados a DELEGAR captação pra videomaker. */
export const ROLES_COORD_DELEGATE: ReadonlySet<string> = new Set([
  "audiovisual_chefe",
  "socio",
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
