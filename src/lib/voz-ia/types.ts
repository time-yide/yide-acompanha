export const AI_CALL_STATUS = [
  "iniciando", "chamando", "em_andamento",
  "reuniao_agendada", "sem_interesse", "nao_atendeu", "erro",
] as const;
export type AICallStatus = (typeof AI_CALL_STATUS)[number];

export const AI_LEAD_STATUS = [
  "aguardando", "em_ligacao", "followup_wpp",
  "reuniao_agendada", "sem_interesse", "esgotado",
] as const;
export type AILeadStatus = (typeof AI_LEAD_STATUS)[number];

export const VOZES_OPENAI = [
  { value: "alloy", label: "Alloy (neutra)" },
  { value: "echo", label: "Echo (masculina)" },
  { value: "shimmer", label: "Shimmer (feminina)" },
  { value: "ash", label: "Ash (masculina)" },
  { value: "ballad", label: "Ballad (feminina)" },
  { value: "coral", label: "Coral (feminina)" },
  { value: "sage", label: "Sage (neutra)" },
  { value: "verse", label: "Verse (masculina)" },
] as const;

export const ROLES_VOZ_IA = ["adm", "socio", "comercial", "coordenador", "assessor"];
export const ROLES_CONFIG_VOZ_IA = ["adm", "socio"];

export interface AIVoiceConfig {
  id: string;
  organization_id: string;
  nome: string;
  system_prompt: string;
  voz: string;
  temperatura: number;
  duracao_max_segundos: number;
  wpp_followup_ativo: boolean;
  wpp_followup_template: string | null;
  max_tentativas: number;
  tentativas_por_semana: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIVoiceCall {
  id: string;
  organization_id: string;
  lead_gerado_id: string | null;
  config_id: string | null;
  prompt_usado: string;
  voz: string;
  twilio_call_sid: string | null;
  twilio_from: string;
  status: AICallStatus;
  duracao_segundos: number | null;
  transcricao: { role: string; text: string; timestamp: number }[] | null;
  resumo_ia: string | null;
  resultado_detalhe: string | null;
  gravacao_url: string | null;
  calendar_event_id: string | null;
  reuniao_data: string | null;
  followup_wpp_enviado: boolean;
  conversation_id: string | null;
  iniciado_por: string;
  criado_em: string;
  finalizado_em: string | null;
  erro_msg: string | null;
}

export interface TranscriptionItem {
  role: "assistant" | "user";
  text: string;
  timestamp: number;
}

export const OPENAI_REALTIME_TOOLS = [
  {
    type: "function" as const,
    name: "agendar_reuniao",
    description: "Agenda uma reunião com o lead. Use quando o lead concordar com uma data e horário.",
    parameters: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato YYYY-MM-DD" },
        horario: { type: "string", description: "Horário no formato HH:MM" },
        duracao_minutos: { type: "number", description: "Duração em minutos (padrão 30)" },
      },
      required: ["data", "horario"],
    },
  },
  {
    type: "function" as const,
    name: "encerrar_chamada",
    description: "Encerra a chamada educadamente após despedida ou quando o assunto terminou.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function" as const,
    name: "marcar_sem_interesse",
    description: "Marca que o lead não tem interesse. Use quando o lead recusar explicitamente.",
    parameters: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo dado pelo lead" },
      },
    },
  },
] as const;
