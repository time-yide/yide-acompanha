export type AlertStatus = "pendente" | "alinhado_cliente" | "agendado" | "concluido";

export interface RecordingAlertRow {
  id: string;
  organization_id: string;
  client_id: string;
  calendar_id: string;
  mes_gravacao: string;
  status: AlertStatus;
  data_gravacao: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  local: string | null;
  observacoes: string | null;
  temas_gravar: { ordem: number; tema: string; roteiro?: string }[];
  calendar_event_id: string | null;
  videomaker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertWithClient extends RecordingAlertRow {
  client_nome: string;
  assessor_id: string | null;
}
