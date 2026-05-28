import type { StatusOp } from "./tipos";

export const PONTOS = { pegar: 5, negociacao: 10, fechar: 50, porReal: 50 } as const;

export interface OportunidadePontos {
  status: StatusOp;
  negociacao_em: string | null;
  fechada_em: string | null;
  valor_comissao: number;
}

/** Pontos derivados do progresso da oportunidade. Acumulativo. */
export function calcularPontos(o: OportunidadePontos): number {
  let p = 0;
  if (o.status !== "disponivel") p += PONTOS.pegar; // pegou
  if (o.negociacao_em) p += PONTOS.negociacao;
  if (o.status === "fechada") {
    p += PONTOS.fechar + Math.floor((o.valor_comissao ?? 0) / PONTOS.porReal);
  }
  return p;
}

const TRANSICOES: Record<StatusOp, StatusOp[]> = {
  disponivel: ["pega"],
  pega: ["em_negociacao", "fechada", "perdida", "disponivel"],
  em_negociacao: ["fechada", "perdida", "pega"],
  fechada: [],
  perdida: ["disponivel"],
};

export function transicaoValida(de: StatusOp, para: StatusOp): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
