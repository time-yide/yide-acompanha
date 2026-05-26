// src/lib/instagram-snapshots/meta-alerta.ts
//
// Avalia se um cliente está "longe" de bater a meta mensal de postagens,
// projetando o total final do mês baseado no ritmo atual. Sem deps —
// funções puras testáveis.

export type MetaStatus = "sem_meta" | "ok" | "atencao" | "critico";

export interface MetaEval {
  /**
   * - sem_meta: cliente não tem meta configurada
   * - ok: projeção >= 90% da meta
   * - atencao: projeção entre 70%-90% da meta
   * - critico: projeção < 70% da meta
   */
  status: MetaStatus;
  /**
   * Total projetado pro fim do mês baseado no ritmo atual.
   * Null nos primeiros dias (não dá pra projetar com 1-2 dias).
   */
  projecao: number | null;
  /** % da meta alcançado até agora (postsMes / meta). Null sem meta. */
  pctMeta: number | null;
  /** Quantos posts faltam pra bater 100% da meta. Null sem meta. */
  faltam: number | null;
}

/** Quantos dias o mês de referência tem (28-31). */
export function diasNoMes(year: number, month: number): number {
  // Truque clássico: dia 0 do próximo mês = último dia do mês atual.
  return new Date(year, month, 0).getDate();
}

/**
 * Avalia status da meta. Considera "dia atual" como decorrido — se hoje é
 * dia 10, já se passaram 10 dias e a projeção usa esse ritmo.
 *
 * Nos primeiros 3 dias retorna 'ok' sem projetar — ritmo de 1-2 dias varia
 * demais pra ser confiável. A partir do dia 3 começa a alertar.
 */
export function evaluateMeta(params: {
  metaMes: number | null;
  postsMes: number;
  diaAtual: number;
  diasNoMes: number;
}): MetaEval {
  const { metaMes, postsMes, diaAtual, diasNoMes: total } = params;

  if (metaMes === null || metaMes === 0) {
    return { status: "sem_meta", projecao: null, pctMeta: null, faltam: null };
  }

  const pctMeta = postsMes / metaMes;
  const faltam = Math.max(0, metaMes - postsMes);

  // Cedo demais pra projetar — devolve OK sem barulho.
  if (diaAtual < 3) {
    return { status: "ok", projecao: null, pctMeta, faltam };
  }

  // Se já bateu a meta, projeção não importa.
  if (postsMes >= metaMes) {
    return { status: "ok", projecao: postsMes, pctMeta, faltam: 0 };
  }

  const ritmoDiario = postsMes / diaAtual;
  const projecao = Math.round(ritmoDiario * total);
  const pctProjecao = projecao / metaMes;

  let status: MetaStatus;
  if (pctProjecao < 0.7) status = "critico";
  else if (pctProjecao < 0.9) status = "atencao";
  else status = "ok";

  return { status, projecao, pctMeta, faltam };
}
