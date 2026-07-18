// Puro/testável — prazo (% no prazo) e agilidade (tempo médio de entrega) de tarefas,
// por pessoa. A query fica em queries.ts. On-time segue a MESMA regra do setor
// assessoria: data de conclusão <= due_date.

export interface TaskPrazoRow {
  atribuido_a: string;
  created_at: string;      // ISO
  completed_at: string;    // ISO (só tarefas já concluídas entram)
  due_date: string | null; // YYYY-MM-DD
}

export interface PrazoAgilidadePessoa {
  user_id: string;
  entregues: number;                 // tarefas concluídas no período
  com_prazo: number;                 // dessas, quantas tinham due_date
  no_prazo: number;                  // concluídas até o due_date
  leadTimeMedioDias: number | null;  // média (completed_at - created_at) em dias
}

export interface PrazoAgilidadeRow extends PrazoAgilidadePessoa {
  nome: string;
}

export interface ResumoPrazoAgilidade {
  entregues: number;
  com_prazo: number;
  no_prazo: number;
  pct: number | null;                // % no prazo do time (null se ninguém tinha prazo)
  leadTimeMedioDias: number | null;
}

const DIA_MS = 86_400_000;

export function computePrazoAgilidade(rows: TaskPrazoRow[]): PrazoAgilidadePessoa[] {
  const map = new Map<string, { entregues: number; com_prazo: number; no_prazo: number; somaLead: number }>();
  for (const t of rows) {
    if (!t.atribuido_a || !t.completed_at) continue;
    const cur = map.get(t.atribuido_a) ?? { entregues: 0, com_prazo: 0, no_prazo: 0, somaLead: 0 };
    cur.entregues += 1;
    const lead = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / DIA_MS;
    cur.somaLead += Number.isFinite(lead) ? Math.max(0, lead) : 0;
    if (t.due_date) {
      cur.com_prazo += 1;
      if (t.completed_at.slice(0, 10) <= t.due_date) cur.no_prazo += 1;
    }
    map.set(t.atribuido_a, cur);
  }
  return [...map.entries()].map(([user_id, c]) => ({
    user_id,
    entregues: c.entregues,
    com_prazo: c.com_prazo,
    no_prazo: c.no_prazo,
    leadTimeMedioDias: c.entregues > 0 ? c.somaLead / c.entregues : null,
  }));
}

export function pctPrazo(noPrazo: number, comPrazo: number): number | null {
  return comPrazo > 0 ? Math.round((noPrazo / comPrazo) * 100) : null;
}

export function resumoPrazoAgilidade(pessoas: PrazoAgilidadePessoa[]): ResumoPrazoAgilidade {
  let entregues = 0, com_prazo = 0, no_prazo = 0, somaLeadPonderada = 0;
  for (const p of pessoas) {
    entregues += p.entregues;
    com_prazo += p.com_prazo;
    no_prazo += p.no_prazo;
    if (p.leadTimeMedioDias != null) somaLeadPonderada += p.leadTimeMedioDias * p.entregues;
  }
  return {
    entregues,
    com_prazo,
    no_prazo,
    pct: pctPrazo(no_prazo, com_prazo),
    leadTimeMedioDias: entregues > 0 ? somaLeadPonderada / entregues : null,
  };
}
