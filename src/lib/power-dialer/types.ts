import "server-only";

export const PD_BATCH_STATUS = {
  DISCANDO: "discando",
  CONECTADO: "conectado",
  TIMEOUT: "timeout",
  CONCLUIDO: "concluido",
  ERRO: "erro",
} as const;

export const PD_CALL_STATUS = {
  DISCANDO: "discando",
  ATENDEU: "atendeu",
  DROPADO: "dropado",
  NAO_ATENDEU: "nao_atendeu",
  OCUPADO: "ocupado",
  ERRO: "erro",
} as const;

export interface PowerDialerConfig {
  power_dialer_ativo: boolean;
  power_dialer_batch_size: number;
  power_dialer_timeout_s: number;
  power_dialer_colaborador_id: string | null;
  power_dialer_greeting: string;
  power_dialer_goodbye: string;
}

export interface PDBatch {
  id: string;
  organization_id: string;
  conference_name: string;
  status: string;
  lead_atendeu_id: string | null;
  colaborador_id: string;
  iniciado_em: string;
  conectado_em: string | null;
  finalizado_em: string | null;
}

export interface PDBatchCall {
  id: string;
  batch_id: string;
  lead_gerado_id: string;
  twilio_call_sid: string | null;
  status: string;
}
