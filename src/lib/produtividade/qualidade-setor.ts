// Puro/testável — qualidade por setor.
// Assessoria: retrabalho = nº de "ajustes solicitados" nas tarefas da pessoa (task_revisoes
// tipo=ajustes, creditado ao DONO da tarefa). Design: % de artes aprovadas vs criadas.

export interface RetrabalhoPessoa {
  user_id: string;
  ajustes: number; // quantas vezes o trabalho dela voltou pra ajuste (menos = melhor)
}

export interface AprovacaoPessoa {
  user_id: string;
  criadas: number;
  aprovadas: number;
}

export interface RetrabalhoRow extends RetrabalhoPessoa { nome: string }
export interface AprovacaoRow extends AprovacaoPessoa { nome: string }

/** Conta ajustes por dono de tarefa. `rows` = revisões tipo=ajustes já filtradas. */
export function computeRetrabalho(rows: Array<{ atribuido_a: string | null }>): RetrabalhoPessoa[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.atribuido_a) continue;
    map.set(r.atribuido_a, (map.get(r.atribuido_a) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([user_id, ajustes]) => ({ user_id, ajustes }))
    .sort((a, b) => b.ajustes - a.ajustes);
}

/** Agrupa artes por criador, contando criadas e aprovadas. */
export function computeAprovacaoDesign(rows: Array<{ criado_por: string | null; aprovada: boolean }>): AprovacaoPessoa[] {
  const map = new Map<string, { criadas: number; aprovadas: number }>();
  for (const r of rows) {
    if (!r.criado_por) continue;
    const cur = map.get(r.criado_por) ?? { criadas: 0, aprovadas: 0 };
    cur.criadas += 1;
    if (r.aprovada) cur.aprovadas += 1;
    map.set(r.criado_por, cur);
  }
  return [...map.entries()]
    .map(([user_id, c]) => ({ user_id, ...c }))
    .sort((a, b) => pctAprovacaoRaw(b) - pctAprovacaoRaw(a) || b.criadas - a.criadas);
}

export function pctAprovacao(aprovadas: number, criadas: number): number | null {
  return criadas > 0 ? Math.round((aprovadas / criadas) * 100) : null;
}

function pctAprovacaoRaw(p: AprovacaoPessoa): number {
  return p.criadas > 0 ? p.aprovadas / p.criadas : -1;
}
