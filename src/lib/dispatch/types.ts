export interface WppTemplate {
  id: string;
  organization_id: string;
  nome: string;
  base_prospeccao: string | null;
  corpo: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export type DispatchStatus =
  | "pendente"
  | "enviando"
  | "enviado"
  | "falhou"
  | "cancelado";

export interface WppDispatchItem {
  id: string;
  organization_id: string;
  lead_gerado_id: string;
  template_id: string | null;
  telefone_destino: string;
  mensagem_renderizada: string;
  status: DispatchStatus;
  erro_msg: string | null;
  tentativas: number;
  agendado_para: string;
  enviado_em: string | null;
  conversation_id: string | null;
  twilio_from: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchStats {
  total: number;
  pendentes: number;
  enviados: number;
  falhou: number;
  enviadosHoje: number;
}

export const DISPATCH_DAILY_LIMIT = 50;
