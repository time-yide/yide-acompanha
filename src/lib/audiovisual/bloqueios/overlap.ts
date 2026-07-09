export interface BlocoHorario {
  hora_inicio: string; // "HH:MM" ou "HH:MM:SS"
  hora_fim: string;
  motivo: string;
}

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Retorna o primeiro bloco que colide com [inicioLocal, fimLocal) (mesmo dia
 * local, wall-clock HH:MM). Adjacência (fim == início) NÃO colide. null se nenhum.
 */
export function bloqueiosColidem(
  blocos: BlocoHorario[],
  inicioLocal: string,
  fimLocal: string,
): BlocoHorario | null {
  const evStart = hhmm(inicioLocal);
  const evEnd = hhmm(fimLocal);
  for (const b of blocos) {
    const bStart = hhmm(b.hora_inicio);
    const bEnd = hhmm(b.hora_fim);
    if (bStart < evEnd && bEnd > evStart) return b;
  }
  return null;
}
