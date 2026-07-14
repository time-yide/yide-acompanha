export type ChannelKind =
  | "geral"
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers"
  | "comercial"
  | "administrativo"
  | "direct"
  | "grupo";

export interface Channel {
  id: string;
  kind: ChannelKind;
  nome: string;
  descricao: string | null;
  ordem: number;
  /** Populado quando kind é 'direct' (2 users) ou 'grupo' (N users escolhidos). */
  member_ids: string[] | null;
  /** Foto custom do canal de grupo (subida por admin). NULL pra DMs. */
  icon_url: string | null;
  /** Quem criou o grupo (kind='grupo'). NULL pros canais fixos e DMs. */
  created_by?: string | null;
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
  /** Só no client: true enquanto a mensagem otimista não foi confirmada pelo
   * server (mostra relógio em vez de check). Nunca vem do banco. */
  pending?: boolean;
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
  "fast_midia",
  "editor",
  "audiovisual_chefe",
  "assessor_ecommerce",
  "assistente_ecommerce",
] as const;

export const CHANNEL_KIND_TO_ROLES: Record<ChannelKind, readonly string[]> = {
  geral: ALL_ROLES,
  assessores_coordenadores: ["assessor", "coordenador", "adm", "socio"],
  coordenadores_estrategico: ["coordenador", "audiovisual_chefe", "adm", "socio"],
  audiovisual_geral: ["videomaker", "fast_midia", "editor", "audiovisual_chefe", "adm", "socio"],
  designers: ["designer", "adm", "socio"],
  comercial: ["comercial", "adm", "socio"],
  administrativo: ["adm", "socio"],
  // 'direct' e 'grupo' não usam role-based access - controle é via member_ids
  // (vide canAccessMemberChannel). Vazio aqui pra satisfazer o Record.
  direct: [],
  grupo: [],
};

export function canAccessChannel(role: string, kind: ChannelKind): boolean {
  return (CHANNEL_KIND_TO_ROLES[kind] as readonly string[]).includes(role);
}

/** Canal cujo acesso é por lista de membros (DM ou grupo). */
export function isMemberBasedKind(kind: ChannelKind): boolean {
  return kind === "direct" || kind === "grupo";
}

/** Acesso a canal por member_ids (DM ou grupo): user precisa estar na lista. */
export function canAccessMemberChannel(channel: Channel, userId: string): boolean {
  if (!isMemberBasedKind(channel.kind) || !channel.member_ids) return false;
  return channel.member_ids.includes(userId);
}

/** Acesso a um grupo: user precisa estar em member_ids. */
export function canAccessGroupChannel(channel: Channel, userId: string): boolean {
  if (channel.kind !== "grupo" || !channel.member_ids) return false;
  return channel.member_ids.includes(userId);
}

/**
 * Só adm/sócio criam grupos (decisão Yasmin).
 */
export function canCreateGroup(role: string): boolean {
  return role === "adm" || role === "socio";
}

/**
 * Gerenciar um grupo (editar membros / apagar): quem criou, ou adm/sócio.
 */
export function canManageGroup(channel: Channel, userId: string, role: string): boolean {
  if (channel.kind !== "grupo") return false;
  return channel.created_by === userId || role === "adm" || role === "socio";
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
