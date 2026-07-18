// Puro/client-safe — sobreposição de slot de freela com um intervalo (UTC).
export interface FreelaSlot {
  titulo: string;
  data_hora: string;   // ISO UTC (início)
  duracao_min: number;
}

/** Retorna o 1º freela cujo slot [data_hora, data_hora+dur) sobrepõe [inicioUtc, fimUtc). Encostar não colide. */
export function freelaColidente(
  freelas: FreelaSlot[],
  inicioUtc: string,
  fimUtc: string,
): FreelaSlot | null {
  const ini = new Date(inicioUtc).getTime();
  const fim = new Date(fimUtc).getTime();
  for (const f of freelas) {
    const fIni = new Date(f.data_hora).getTime();
    const dur = f.duracao_min && f.duracao_min > 0 ? f.duracao_min : 60;
    const fFim = fIni + dur * 60_000;
    if (fIni < fim && fFim > ini) return f;
  }
  return null;
}
