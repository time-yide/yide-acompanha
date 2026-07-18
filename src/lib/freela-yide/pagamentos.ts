// src/lib/freela-yide/pagamentos.ts
// Agregação pura de pagamentos de freela por mês e colaborador. Sem IO (testável).
// A query (com filtro de canceladas etc.) fica em queries.ts.

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface PagamentoInput {
  pego_por: string;
  nome: string;
  valor_comissao: number;
  pego_em: string; // ISO
}

export interface PagamentoColaborador {
  user_id: string;
  nome: string;
  qtd: number;
  total: number;
}

export interface MesPagamentos {
  chave: string; // "AAAA-MM"
  label: string; // "Julho 2026"
  total: number;
  colaboradores: PagamentoColaborador[];
}

// Mesma lógica de chaveMes/labelMes do histórico, pra os meses baterem com o ranking.
function chaveMes(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return `${MESES_PT[mes - 1] ?? "?"} ${ano}`;
}

/**
 * Agrupa freelas pegas (canceladas já filtradas fora) por mês (pego_em) e colaborador,
 * somando o valor a pagar. Meses do mais recente pro mais antigo; dentro do mês,
 * colaboradores do maior total pro menor (empate → nome A→Z).
 */
export function agregarPagamentos(rows: PagamentoInput[]): MesPagamentos[] {
  const porMes = new Map<string, Map<string, PagamentoColaborador>>();
  for (const r of rows) {
    const chave = chaveMes(r.pego_em);
    if (!porMes.has(chave)) porMes.set(chave, new Map());
    const m = porMes.get(chave)!;
    const cur = m.get(r.pego_por) ?? { user_id: r.pego_por, nome: r.nome, qtd: 0, total: 0 };
    cur.qtd += 1;
    cur.total += Number(r.valor_comissao ?? 0);
    m.set(r.pego_por, cur);
  }
  return [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([chave, m]) => {
      const colaboradores = [...m.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
      return {
        chave,
        label: labelMes(chave),
        total: colaboradores.reduce((s, c) => s + c.total, 0),
        colaboradores,
      };
    });
}
