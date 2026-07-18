import type { StatusOp } from "./tipos";

export const PONTOS = { pegar: 5, negociacao: 10 } as const;

export interface OportunidadePontos {
  status: StatusOp;
  negociacao_em: string | null;
  fechada_em: string | null;
  valor_comissao: number;
}

/**
 * Bônus de fechamento INVERSO ao valor: freela de comissão menor rende mais ponto,
 * pra motivar o time a pegar as menos vantajosas (as gordas já atraem pelo R$).
 */
export function bonusFechamento(valorComissao: number): number {
  const v = valorComissao ?? 0;
  if (v <= 100) return 80;
  if (v <= 300) return 55;
  if (v <= 600) return 35;
  if (v <= 1000) return 20;
  return 10;
}

/** Pontos derivados do progresso da oportunidade. Acumulativo. */
export function calcularPontos(o: OportunidadePontos): number {
  let p = 0;
  if (o.status !== "disponivel") p += PONTOS.pegar; // pegou
  if (o.negociacao_em) p += PONTOS.negociacao;
  if (o.status === "fechada") p += bonusFechamento(o.valor_comissao ?? 0);
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
