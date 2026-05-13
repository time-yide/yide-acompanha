// Template das 9 etapas do onboarding D0 → D30 (decisão Yasmin — fluxo
// completo desde a entrada do cliente até o primeiro mês ativo).
//
// Quando cliente vira `status='ativo'`, trigger no banco insere uma linha em
// `client_onboarding_etapas` por etapa, copiando `fluxo` e `saidas` daqui.
// Mudar o template aqui afeta APENAS clientes futuros — os já criados
// preservam o checklist deles (snapshot do template na época).

export type EtapaCodigo =
  | "entrada"
  | "cadastro"
  | "marco_zero"
  | "trafego"
  | "producao"
  | "apresentacao"
  | "publicacao"
  | "monitoramento"
  | "relacionamento";

export type StatusEtapa = "pendente" | "em_progresso" | "concluido";

export type ResponsavelTipo =
  | "comercial"
  | "adm"
  | "coordenador"
  | "assessor"
  | "time_operacional";

export interface EtapaTemplate {
  numero: number;
  codigo: EtapaCodigo;
  nome: string;
  dia_inicio_previsto: number | null; // null = contínua
  dia_fim_previsto: number | null;
  responsaveis: ResponsavelTipo[];
  /** Itens do "Fluxo" — coisas que tem que fazer dentro da etapa. */
  fluxo: string[];
  /** "Saídas obrigatórias" — entregáveis pra etapa ser considerada concluída. */
  saidas: string[];
}

export const D0_D30_TEMPLATE: readonly EtapaTemplate[] = [
  {
    numero: 1,
    codigo: "entrada",
    nome: "Entrada do lead",
    dia_inicio_previsto: 0,
    dia_fim_previsto: 2,
    responsaveis: ["comercial"],
    fluxo: ["Apresenta proposta e fecha"],
    saidas: [
      "Cliente fechado com escopo definido",
      "Informações claras para o ADM",
    ],
  },
  {
    numero: 2,
    codigo: "cadastro",
    nome: "Cadastro e organização",
    dia_inicio_previsto: 3,
    dia_fim_previsto: 4,
    responsaveis: ["adm"],
    fluxo: [
      "Cadastro completo do cliente",
      "Inserção no CRM",
      "Registro de contrato",
      "Organização de pagamento (recorrência ou entrada)",
      "Criação de pasta/drive do cliente",
      "Marca a reunião de marco zero",
    ],
    saidas: [
      "Cliente 100% documentado",
      "Financeiro organizado",
      "Pronto para enviar ao Coordenador",
      "Reunião de marco zero agendada no sistema",
    ],
  },
  {
    numero: 3,
    codigo: "marco_zero",
    nome: "Reunião marco zero + estratégia",
    dia_inicio_previsto: 5,
    dia_fim_previsto: 7,
    responsaveis: ["coordenador", "assessor"],
    fluxo: [
      "Agendamento da reunião (Cliente + Coordenador + Assessor)",
      "Reunião marco zero com cliente",
      "Alinhamento de expectativas",
      "Explicação de como funciona o processo",
      "Levantamento inicial de informações",
      "Entender profundamente o cliente",
      "Preencher material do briefing do cliente",
    ],
    saidas: [
      "Cliente seguro e alinhado",
      "Briefing estruturado",
      "Reunião de estratégia",
      "Estratégia clara",
      "Direcionamento para execução",
    ],
  },
  {
    numero: 4,
    codigo: "trafego",
    nome: "Tráfego + estratégia",
    dia_inicio_previsto: 7,
    dia_fim_previsto: 12,
    responsaveis: ["assessor"],
    fluxo: [
      "Entender profundamente o cliente",
      "Subir campanha de tráfego",
      "Montar estratégia de tráfego",
    ],
    saidas: [
      "Estratégia clara",
      "Direcionamento para execução",
      "Tráfego ativo",
    ],
  },
  {
    numero: 5,
    codigo: "producao",
    nome: "Planejamento e produção",
    dia_inicio_previsto: 13,
    dia_fim_previsto: 23,
    responsaveis: ["coordenador", "time_operacional"],
    fluxo: [
      "Assessor agenda gravações",
      "Assessor monta estratégia",
      "Time operacional executa captação",
      "Time operacional executa design",
      "Time operacional executa edição",
    ],
    saidas: ["Conteúdos prontos"],
  },
  {
    numero: 6,
    codigo: "apresentacao",
    nome: "Apresentação ao cliente",
    dia_inicio_previsto: 24,
    dia_fim_previsto: 26,
    responsaveis: ["assessor"],
    fluxo: ["Apresentar estratégia completa para o cliente"],
    saidas: ["Conteúdo aprovado"],
  },
  {
    numero: 7,
    codigo: "publicacao",
    nome: "Publicação + tráfego",
    dia_inicio_previsto: 30,
    dia_fim_previsto: 30,
    responsaveis: ["assessor"],
    fluxo: ["Postagem"],
    saidas: ["Conteúdo rodando"],
  },
  {
    numero: 8,
    codigo: "monitoramento",
    nome: "Monitoramento e otimização",
    dia_inicio_previsto: null, // contínuo a partir do D30
    dia_fim_previsto: null,
    responsaveis: ["assessor"],
    fluxo: [
      "Análise de métricas",
      "Ajustes em campanhas",
      "Ajustes em conteúdo",
      "Identificação de oportunidades",
    ],
    saidas: ["Melhoria contínua"],
  },
  {
    numero: 9,
    codigo: "relacionamento",
    nome: "Relacionamento contínuo",
    dia_inicio_previsto: null, // contínuo a partir do D5
    dia_fim_previsto: null,
    responsaveis: ["coordenador", "assessor"],
    fluxo: [
      "Acompanhamento do cliente",
      "Organização de demandas",
      "Gestão de agenda",
      "Controle de pagamentos recorrentes",
    ],
    saidas: ["Cliente ativo e satisfeito"],
  },
] as const;

export const RESPONSAVEL_LABEL: Record<ResponsavelTipo, string> = {
  comercial: "Comercial",
  adm: "ADM",
  coordenador: "Coordenador",
  assessor: "Assessor",
  time_operacional: "Time operacional",
};

export interface ChecklistItem {
  label: string;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
}

export function makeInitialChecklist(items: readonly string[]): ChecklistItem[] {
  return items.map((label) => ({ label, done: false, done_by: null, done_at: null }));
}

/**
 * Calcula em qual "dia D" estamos relativo ao d0Date.
 * D0 = mesmo dia que data_entrada. D7 = 7 dias depois.
 */
export function getDiaAtual(d0Date: string, now: Date = new Date()): number {
  // Usa Date.UTC pra evitar surpresas de fuso quando d0 é DATE puro.
  const [y, m, d] = d0Date.split("-").map(Number);
  const d0 = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffMs = today - d0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Soma N dias a uma data YYYY-MM-DD e retorna no formato curto pt-BR (DD/MM).
 * Ex.: addDaysShort("2026-04-24", 5) → "29/04"
 */
export function addDaysShort(d0Date: string, n: number): string {
  const [y, m, d] = d0Date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Formata range de uma etapa em DD/MM - DD/MM. Se inicio === fim, devolve
 * só uma data. Para etapas contínuas (null), devolve string vazia.
 */
export function formatEtapaRangeDates(
  d0Date: string,
  diaInicio: number | null,
  diaFim: number | null,
): string {
  if (diaInicio === null || diaFim === null) return "";
  const inicio = addDaysShort(d0Date, diaInicio);
  const fim = addDaysShort(d0Date, diaFim);
  return inicio === fim ? inicio : `${inicio}–${fim}`;
}
