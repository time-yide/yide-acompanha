export interface LeadParaProspectar {
  id: string;
  empresa: string;
  telefone: string | null;
  whatsapp: string | null;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  website: string | null;
  porte_empresa: string | null;
  ai_tentativas: number;
  ai_status: string | null;
  decisor_nome: string | null;
}

export interface MotorResult {
  orgId: string;
  processados: number;
  wppEnviados: number;
  ligacoesDisparadas: number;
  erros: number;
  detalhes: { leadId: string; acao: string; erro?: string }[];
}

export interface MotorGlobalResult {
  orgs: number;
  totalProcessados: number;
  totalWpp: number;
  totalLigacoes: number;
  totalErros: number;
  porOrg: MotorResult[];
}

export const MOTOR_BATCH_SIZE = 5;
export const MOTOR_INTERVALO_MIN_HORAS = 48;
