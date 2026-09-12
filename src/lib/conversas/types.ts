export type CanalConversa = "whatsapp";
export type StatusMensagem = "enviando" | "enviada" | "entregue" | "lida" | "falhou";
export type AutorMensagem = "lead" | "comercial" | "sistema" | "ia";

export interface WppConversation {
  id: string;
  organization_id: string;
  contato_nome: string;
  contato_telefone: string;
  canal: CanalConversa;
  lead_gerado_id: string | null;
  lead_nome: string | null;
  ultimo_texto: string | null;
  ultima_msg_em: string | null;
  nao_lidas: number;
  arquivada: boolean;
  fixada: boolean;
  twilio_from: string | null;
  ai_ativa: boolean;
  ai_config_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WppMessage {
  id: string;
  conversation_id: string;
  autor: AutorMensagem;
  texto: string;
  media_url: string | null;
  media_type: string | null;
  twilio_sid: string | null;
  status: StatusMensagem;
  enviado_por: string | null;
  created_at: string;
}
