// Métricas de tempo das tarefas (subpágina /tarefas/metricas).
// Cálculo puro e testável — sem I/O. Espelha o estilo de calendario/temperatura.

/** Status em que a tarefa ainda está "viva" (trabalho pendente). O resto
 *  (em_aprovacao/aprovada/agendado/postada/concluida) já saiu das mãos de quem
 *  executa — não conta como atrasada/parada. Mesmo conjunto de overdue-rules. */
export const STATUS_EM_ABERTO = new Set(["aberta", "em_andamento", "alteracao"]);

/** Dias sem nenhuma edição pra tarefa contar como "parada". */
export const PARADA_DIAS = 3;

export interface MetricaTarefaInput {
  id: string;
  titulo: string;
  status: string;
  due_date: string | null; // 'YYYY-MM-DD'
  updated_at?: string | null; // ISO
  created_at?: string | null; // ISO
  completed_at?: string | null; // ISO
  atribuido_a?: string | null;
}

export interface RankItem {
  id: string;
  titulo: string;
  responsavelId: string | null;
  dias: number;
}

export interface TarefasMetricas {
  /** Total de tarefas em aberto (base das demais métricas). */
  emAberto: number;
  atrasadas: { count: number; mediaDias: number; top: RankItem[] };
  paradas: { count: number; mediaDias: number; top: RankItem[] };
  /** Em aberto sem due_date (não dá pra cobrar prazo). */
  semPrazo: number;
  /** Média (completed_at − created_at) em dias das concluídas com ambos os
   *  carimbos. null quando não há nenhuma. */
  tempoMedioConclusaoDias: number | null;
}

const MS_DIA = 24 * 60 * 60 * 1000;

/** Diferença em dias inteiros (floor) entre duas datas ISO. */
function diasEntre(aIso: string, bIso: string): number {
  return Math.floor((new Date(aIso).getTime() - new Date(bIso).getTime()) / MS_DIA);
}

/** Dias de atraso: hoje (data) − due_date (data), só a parte de dias. */
function diasDeAtraso(dueDate: string, hojeIso: string): number {
  const hoje = hojeIso.slice(0, 10);
  return Math.floor(
    (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / MS_DIA,
  );
}

function media(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function computeTarefasMetricas(
  tasks: MetricaTarefaInput[],
  nowIso: string,
): TarefasMetricas {
  const hojeData = nowIso.slice(0, 10);
  const emAberto = tasks.filter((t) => STATUS_EM_ABERTO.has(t.status));

  // Atrasadas: em aberto + due_date já passou.
  const atrasadasArr = emAberto
    .filter((t) => t.due_date && t.due_date < hojeData)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      responsavelId: t.atribuido_a ?? null,
      dias: diasDeAtraso(t.due_date as string, nowIso),
    }))
    .sort((a, b) => b.dias - a.dias);

  // Paradas: em aberto + sem edição há PARADA_DIAS+ dias.
  const paradasArr = emAberto
    .filter((t) => !!t.updated_at)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      responsavelId: t.atribuido_a ?? null,
      dias: diasEntre(nowIso, t.updated_at as string),
    }))
    .filter((t) => t.dias >= PARADA_DIAS)
    .sort((a, b) => b.dias - a.dias);

  const semPrazo = emAberto.filter((t) => !t.due_date).length;

  const duracoes = tasks
    .filter((t) => t.completed_at && t.created_at)
    .map((t) => diasEntre(t.completed_at as string, t.created_at as string))
    .filter((d) => d >= 0);
  const tempoMedioConclusaoDias = duracoes.length > 0 ? media(duracoes) : null;

  return {
    emAberto: emAberto.length,
    atrasadas: {
      count: atrasadasArr.length,
      mediaDias: media(atrasadasArr.map((t) => t.dias)),
      top: atrasadasArr.slice(0, 5),
    },
    paradas: {
      count: paradasArr.length,
      mediaDias: media(paradasArr.map((t) => t.dias)),
      top: paradasArr.slice(0, 5),
    },
    semPrazo,
    tempoMedioConclusaoDias,
  };
}
