/**
 * Helpers pra distinguir videomakers de câmera vs mobile.
 * Ambos compartilham permissões — só o painel mensal diferencia
 * (CAM vs MOB) baseado em qual role entregou a captura.
 */

export type VideomakerRole = "videomaker" | "videomaker_mobile";

const VIDEOMAKER_ROLES_SET = new Set<string>(["videomaker", "videomaker_mobile"]);

/**
 * True pra qualquer um dos 2 tipos de videomaker.
 * Usar onde permissões/filtros aceitam "videomaker" historicamente.
 */
export function isVideomakerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return VIDEOMAKER_ROLES_SET.has(role);
}

export const VIDEOMAKER_ROLES: readonly VideomakerRole[] = [
  "videomaker",
  "videomaker_mobile",
];
