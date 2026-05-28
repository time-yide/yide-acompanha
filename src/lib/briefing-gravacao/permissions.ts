// src/lib/briefing-gravacao/permissions.ts

const ROLES_OVERRIDE_CHECK = ["audiovisual_chefe", "adm", "socio"] as const;
const ROLES_UPLOAD = [
  "assessor",
  "coordenador",
  "audiovisual_chefe",
  "adm",
  "socio",
] as const;

interface Actor {
  userId: string;
  role: string;
}

interface EventoMinimo {
  participantes_ids: string[];
}

/**
 * Pode marcar checks (leu / imprimiu) se:
 *  - É videomaker designado no evento, OU
 *  - É role de override (audiovisual_chefe / adm / sócio) marcando em nome.
 *
 * Quando override, `confirmacao_marcada_por` no DB guardará o userId pro
 * audit trail.
 */
export function podeMarcarCheck(actor: Actor, evento: EventoMinimo): boolean {
  if ((ROLES_OVERRIDE_CHECK as readonly string[]).includes(actor.role)) {
    return true;
  }
  return evento.participantes_ids.includes(actor.userId);
}

export function podeUploadRoteiro(role: string): boolean {
  return (ROLES_UPLOAD as readonly string[]).includes(role);
}
