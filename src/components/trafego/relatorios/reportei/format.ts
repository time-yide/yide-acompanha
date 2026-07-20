// src/components/trafego/relatorios/reportei/format.ts
//
// Formatação pt-BR compartilhada pelo dashboard Reportei. Sem deps de client.

export function fmtMoeda(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function fmtNumero(v: number): string {
  return Math.round(v).toLocaleString("pt-BR");
}

export function fmtPercent(v: number): string {
  return `${v.toFixed(2).replace(".", ",")}%`;
}

/** "01/07/2026" a partir de "2026-07-01". */
export function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "01/07" curto pro eixo do gráfico. */
export function fmtDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export interface Variacao {
  /** Percentual arredondado, sempre positivo (o sinal vai no `direcao`). */
  pct: number;
  direcao: "sobe" | "desce";
  /** True quando a variação é boa pro cliente (verde). */
  positiva: boolean;
}

/**
 * Calcula a variação % entre atual e anterior. Retorna null quando não há
 * base de comparação (anterior ausente ou zero) — aí o selo é omitido.
 *
 * `menorMelhor=true` para métricas de custo (CPL/CPA/CPC): cair é bom.
 */
export function calcVariacao(
  atual: number | undefined,
  anterior: number | undefined,
  menorMelhor = false,
): Variacao | null {
  if (atual === undefined || anterior === undefined) return null;
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  if (anterior === 0) return null;
  const delta = (atual - anterior) / anterior;
  if (delta === 0) return null;
  const sobe = delta > 0;
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return null;
  // "positiva" = boa pro cliente. Pra custo, subir é ruim.
  const positiva = menorMelhor ? !sobe : sobe;
  return { pct, direcao: sobe ? "sobe" : "desce", positiva };
}
