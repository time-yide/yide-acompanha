// Puro/client-safe — sem imports de server. Agrega lançamentos por tipo.
export interface ResumoLancamentos {
  crm: number;
  usuarios: number;
  sistemas: number;
  total: number;
}

export function resumoLancamentos(
  rows: Array<{ tipo: string; quantidade: number }>,
): ResumoLancamentos {
  const r: ResumoLancamentos = { crm: 0, usuarios: 0, sistemas: 0, total: 0 };
  for (const l of rows) {
    const q = Number(l.quantidade ?? 0);
    r.total += q;
    if (l.tipo === "crm_conectado") r.crm += q;
    else if (l.tipo === "usuario_criado") r.usuarios += q;
    else if (l.tipo === "sistema_feito") r.sistemas += q;
  }
  return r;
}
