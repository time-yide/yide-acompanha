// Dias úteis sobre datas puras "YYYY-MM-DD" (sem hora → sem problema de fuso).
// Pula só sábado e domingo; feriados ficam fora por enquanto.
// Client-safe: sem dependências de servidor.

/** Prazo padrão de edição: dias úteis contados da data da gravação. */
export const PRAZO_EDICAO_DIAS_UTEIS = 3;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(v: unknown): v is string {
  return typeof v === "string" && YMD.test(v);
}

/** Soma `n` dias úteis a uma data "YYYY-MM-DD". */
export function addDiasUteis(ymd: string, n: number): string {
  if (!isYmd(ymd)) throw new Error(`Data inválida: ${ymd}`);
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < n) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return dt.toISOString().slice(0, 10);
}

/** Prazo padrão da edição = data da gravação + 3 dias úteis. */
export function prazoEdicaoPadrao(dataGravacaoYmd: string): string {
  return addDiasUteis(dataGravacaoYmd, PRAZO_EDICAO_DIAS_UTEIS);
}
