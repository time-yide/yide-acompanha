import { PACOTE_COLUMNS, type ColumnKey, type TipoPacote } from "./pacote-matrix";
import type { ChecklistRow, ChecklistStepRow } from "./queries";

export type GlobalStatus = "concluido" | "atrasado" | "em_producao" | "aberto";

const COLUNA_STEP_KEY: Partial<Record<ColumnKey, string>> = {
  crono: "cronograma",
  camera: "camera", // "Gravação"
  edicao: "edicao",
  reuniao: "reuniao",
};

function isApplicable(pacote: TipoPacote, coluna: ColumnKey): boolean {
  return PACOTE_COLUMNS[pacote][coluna] === 1;
}

/**
 * Calcula o status global de um cliente no painel mensal:
 * - concluido: todos os steps aplicáveis prontos + postagem >= pacote
 * - atrasado: algum step aplicável com status "atrasada"
 * - em_producao: tem ao menos 1 step "em_andamento" ou "pronto"
 * - aberto: ninguém começou ainda
 */
export function computeGlobalStatus(row: ChecklistRow): GlobalStatus {
  const pacote = row.client_tipo_pacote;
  const stepsAplicaveis = (Object.keys(COLUNA_STEP_KEY) as ColumnKey[])
    .filter((col) => isApplicable(pacote, col))
    .map((col) => COLUNA_STEP_KEY[col]!);

  const stepsRow = stepsAplicaveis.map((sk) => row.steps.find((s) => s.step_key === sk));

  const hasAtrasada = stepsRow.some((s) => s?.status === "atrasada");
  if (hasAtrasada) return "atrasado";

  const todosProntos = stepsAplicaveis.length > 0 && stepsRow.every((s) => s?.status === "pronto");

  // Pacote/post: se aplicável, exige postagem completa pra "concluido"
  const pacotePostAplicavel = isApplicable(pacote, "pacote_postados");
  const pacoteOk = !pacotePostAplicavel
    || (row.pacote_post != null && row.quantidade_postada != null && row.quantidade_postada >= row.pacote_post && row.pacote_post > 0);

  if (todosProntos && pacoteOk) return "concluido";

  const algumIniciado = stepsRow.some((s) => s?.status === "em_andamento" || s?.status === "pronto")
    || (row.quantidade_postada ?? 0) > 0;
  if (algumIniciado) return "em_producao";

  return "aberto";
}

const STATUS_META: Record<GlobalStatus, { label: string; classes: string; dotClass: string }> = {
  concluido: { label: "Concluído", classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dotClass: "bg-emerald-500" },
  atrasado:  { label: "Atrasado", classes: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400", dotClass: "bg-rose-500" },
  em_producao: { label: "Em produção", classes: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", dotClass: "bg-amber-500" },
  aberto: { label: "Aberto", classes: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400", dotClass: "bg-slate-400" },
};

export function statusMeta(status: GlobalStatus) {
  return STATUS_META[status];
}

/** Aggregação de status pra KPIs do header. */
export function aggregateStatus(rows: ChecklistRow[]): Record<GlobalStatus, number> {
  const counts: Record<GlobalStatus, number> = { concluido: 0, atrasado: 0, em_producao: 0, aberto: 0 };
  for (const r of rows) counts[computeGlobalStatus(r)] += 1;
  return counts;
}

/** Verifica step específico atrasado (pra alertas no card). */
export function isStepAtrasada(steps: ChecklistStepRow[], stepKey: string): boolean {
  return steps.some((s) => s.step_key === stepKey && s.status === "atrasada");
}
