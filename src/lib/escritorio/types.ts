export type ChannelKind =
  | "geral"
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers"
  | "comercial"
  | "administrativo"
  | "direct";

export interface Channel {
  id: string;
  kind: ChannelKind;
  nome: string;
  descricao: string | null;
  ordem: number;
  /** Populado só quando kind === 'direct'. Array com os 2 user_ids do DM. */
  member_ids: string[] | null;
  /** Foto custom do canal de grupo (subida por admin). NULL pra DMs. */
  icon_url: string | null;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  autor_id: string;
  conteudo: string;
  reply_to_id: string | null;
  attachment_urls: string[];
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string | null;
  autor?: { id: string; nome: string; avatar_url?: string | null } | null;
  reply_to?: { id: string; conteudo: string; autor_nome: string | null } | null;
}

export interface ChannelLastMessagePreview {
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  created_at: string;
}

export interface ChannelDmOther {
  id: string;
  nome: string;
  avatar_url: string | null;
}

export interface ChannelWithUnread extends Channel {
  unread_count: number;
  last_message_at: string | null;
  last_message: ChannelLastMessagePreview | null;
  /** Populado só pra DM (kind='direct'). Outro membro (não o viewer). */
  dm_other: ChannelDmOther | null;
}

const ALL_ROLES = [
  "adm",
  "socio",
  "coordenador",
  "assessor",
  "comercial",
  "designer",
  "videomaker",
  "editor",
  "audiovisual_chefe",
] as const;

export const CHANNEL_KIND_TO_ROLES: Record<ChannelKind, readonly string[]> = {
  geral: ALL_ROLES,
  assessores_coordenadores: ["assessor", "coordenador", "adm", "socio"],
  coordenadores_estrategico: ["coordenador", "audiovisual_chefe", "adm", "socio"],
  audiovisual_geral: ["videomaker", "editor", "audiovisual_chefe", "adm", "socio"],
  designers: ["designer", "adm", "socio"],
  comercial: ["comercial", "adm", "socio"],
  administrativo: ["adm", "socio"],
  // 'direct' não usa role-based access - controle é via member_ids
  // (vide canAccessDmChannel). Mantemos vazio aqui pra satisfazer o
  // Record<ChannelKind, ...>.
  direct: [],
};

export function canAccessChannel(role: string, kind: ChannelKind): boolean {
  return (CHANNEL_KIND_TO_ROLES[kind] as readonly string[]).includes(role);
}

/**
 * Pra um DM (kind='direct'), retorna o ID do OUTRO membro a partir
 * do viewer. Se viewer é o único em member_ids (autodm - bloqueado
 * mas defensivo), retorna o próprio.
 */
export function dmOtherMemberId(channel: Channel, viewerId: string): string {
  if (channel.kind !== "direct" || !channel.member_ids) return viewerId;
  return channel.member_ids.find((id) => id !== viewerId) ?? viewerId;
}

/**
 * Permissão pra acessar um DM channel. User precisa estar em member_ids.
 * Não usa role - DM é per-user.
 */
export function canAccessDmChannel(channel: Channel, userId: string): boolean {
  if (channel.kind !== "direct" || !channel.member_ids) return false;
  return channel.member_ids.includes(userId);
}

/**
 * Pode apagar o DM (hard delete, pros dois): participante do DM, ou sócio/adm.
 * Só vale pra kind='direct'.
 */
export function canDeleteDm(channel: Channel, userId: string, role: string): boolean {
  if (channel.kind !== "direct" || !channel.member_ids) return false;
  return channel.member_ids.includes(userId) || role === "socio" || role === "adm";
}

/**
 * Pode soft-deletar um canal fixo: só sócio, e nunca DM (DM usa canDeleteDm).
 */
export function canDeleteChannel(role: string, channel: Channel): boolean {
  return role === "socio" && channel.kind !== "direct";
}
