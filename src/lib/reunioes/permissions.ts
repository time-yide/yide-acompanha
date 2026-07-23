// Fonte única de permissões do módulo Reuniões.

/** Roles que podem INICIAR uma gravação de reunião de cliente. */
export const RECORD_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;

/** Roles de gestão que veem QUALQUER reunião. */
export const MANAGEMENT_ROLES = ["adm", "socio", "coordenador"] as const;

export function canRecordMeeting(role: string): boolean {
  return (RECORD_ROLES as readonly string[]).includes(role);
}

/**
 * Visibilidade: dono (quem gravou) OU gestão. Assessor não vê reunião de
 * cliente de outro assessor.
 */
export function podeVerReuniao(
  user: { id: string; role: string },
  meeting: { owner_user_id: string },
): boolean {
  if (user.id === meeting.owner_user_id) return true;
  return (MANAGEMENT_ROLES as readonly string[]).includes(user.role);
}
