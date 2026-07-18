/**
 * "Tempo pra entregar" material de gravação (turnaround audiovisual).
 *
 * Mede quanto tempo passou entre o FIM da gravação e o momento em que a pessoa
 * subiu o material (registrou a entrega com link do Drive). Por pessoa, no
 * período: tempo médio, pendentes (gravou e ainda não subiu, com relógio
 * correndo) e a mais lenta/recorde.
 *
 * Módulo puro (sem "use server") — a agregação é testável isolada da query.
 */

export interface EntregaMaterialStats {
  /** Capturas entregues no período (base da média e do recorde). */
  entregues: number;
  /** Média em segundos de (entrega − fim da gravação). Null se 0 entregues. */
  turnaround_medio_seg: number | null;
  /** Maior turnaround do período em segundos (a mais lenta). Null se 0. */
  mais_lenta_seg: number | null;
  /** Gravações já ocorridas ainda sem entrega. */
  pendentes: number;
  /** Idade (seg) da pendente mais antiga = agora − fim da gravação. Null se 0. */
  pendente_mais_antiga_seg: number | null;
}

export interface EntregueInput {
  user_id: string;
  /** ISO — audiovisual_capturas.created_at (quando subiu o material). */
  entrega_at: string;
  /** ISO — fim da gravação (fallback: início). */
  gravacao_ref: string;
}

export interface PendenteInput {
  user_id: string;
  /** ISO — fim da gravação (fallback: início). */
  gravacao_ref: string;
}

/** Segundos entre o fim da gravação e a entrega. Nunca negativo. */
export function turnaroundSeconds(entregaAt: string, gravacaoRef: string): number {
  const diff = new Date(entregaAt).getTime() - new Date(gravacaoRef).getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Agrega estatísticas de entrega por user_id. `nowMs` é o "agora" pro relógio
 * das pendentes (passado explícito pra ser determinístico/testável).
 */
export function aggregateEntregaMaterial(
  entregues: EntregueInput[],
  pendentes: PendenteInput[],
  nowMs: number,
): Map<string, EntregaMaterialStats> {
  interface Acc {
    somaTurn: number;
    n: number;
    maisLenta: number;
    pendentes: number;
    pendenteMaisAntiga: number;
  }
  const acc = new Map<string, Acc>();
  const bucket = (u: string): Acc => {
    let x = acc.get(u);
    if (!x) {
      x = { somaTurn: 0, n: 0, maisLenta: 0, pendentes: 0, pendenteMaisAntiga: 0 };
      acc.set(u, x);
    }
    return x;
  };

  for (const e of entregues) {
    const t = turnaroundSeconds(e.entrega_at, e.gravacao_ref);
    const x = bucket(e.user_id);
    x.somaTurn += t;
    x.n += 1;
    if (t > x.maisLenta) x.maisLenta = t;
  }

  for (const p of pendentes) {
    const age = Math.max(0, Math.floor((nowMs - new Date(p.gravacao_ref).getTime()) / 1000));
    const x = bucket(p.user_id);
    x.pendentes += 1;
    if (age > x.pendenteMaisAntiga) x.pendenteMaisAntiga = age;
  }

  const out = new Map<string, EntregaMaterialStats>();
  for (const [u, x] of acc) {
    out.set(u, {
      entregues: x.n,
      turnaround_medio_seg: x.n > 0 ? Math.round(x.somaTurn / x.n) : null,
      mais_lenta_seg: x.n > 0 ? x.maisLenta : null,
      pendentes: x.pendentes,
      pendente_mais_antiga_seg: x.pendentes > 0 ? x.pendenteMaisAntiga : null,
    });
  }
  return out;
}
