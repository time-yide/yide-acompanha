export type ChannelKind =
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers";

export interface Channel {
  id: string;
  kind: ChannelKind;
  nome: string;
  descricao: string | null;
  ordem: number;
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

export interface ChannelWithUnread extends Channel {
  unread_count: number;
}

export const CHANNEL_KIND_TO_ROLES: Record<ChannelKind, readonly string[]> = {
  assessores_coordenadores: ["assessor", "coordenador", "adm", "socio"],
  coordenadores_estrategico: ["coordenador", "audiovisual_chefe", "adm", "socio"],
  audiovisual_geral: ["videomaker", "editor", "audiovisual_chefe", "adm", "socio"],
  designers: ["designer", "adm", "socio"],
};

export function canAccessChannel(role: string, kind: ChannelKind): boolean {
  return (CHANNEL_KIND_TO_ROLES[kind] as readonly string[]).includes(role);
}
