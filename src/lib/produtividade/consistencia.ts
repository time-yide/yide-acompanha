// Puro/testável — consistência: em quantos dias úteis do período a pessoa entregou
// (concluiu tarefa). Regularidade = dias com entrega / dias úteis do período.

export interface ConsistenciaPessoa {
  user_id: string;
  diasComEntrega: number;
}

export interface ConsistenciaRow extends ConsistenciaPessoa {
  nome: string;
}

/** `rows`: uma linha por tarefa concluída, com a data LOCAL (YYYY-MM-DD) da conclusão. */
export function computeConsistencia(rows: Array<{ atribuido_a: string | null; dataLocal: string }>): ConsistenciaPessoa[] {
  const dias = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.atribuido_a || !r.dataLocal) continue;
    let set = dias.get(r.atribuido_a);
    if (!set) { set = new Set(); dias.set(r.atribuido_a, set); }
    set.add(r.dataLocal);
  }
  return [...dias.entries()]
    .map(([user_id, set]) => ({ user_id, diasComEntrega: set.size }))
    .sort((a, b) => b.diasComEntrega - a.diasComEntrega);
}

/** Conta dias úteis (seg–sex) entre duas datas YYYY-MM-DD, inclusivo. */
export function diasUteisEntre(sinceIso: string, ateIso: string): number {
  const start = new Date(`${sinceIso}T00:00:00.000Z`);
  const end = new Date(`${ateIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const d = new Date(start);
  // Limite de segurança pra não iterar infinito (período máximo ~ 1 mês).
  for (let i = 0; i < 400 && d <= end; i++) {
    const wd = d.getUTCDay(); // 0 dom, 6 sáb
    if (wd !== 0 && wd !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export function pctRegularidade(diasComEntrega: number, diasUteis: number): number | null {
  if (diasUteis <= 0) return null;
  return Math.min(100, Math.round((diasComEntrega / diasUteis) * 100));
}
