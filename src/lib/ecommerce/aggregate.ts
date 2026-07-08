export interface AnuncioAggRow {
  data: string; // YYYY-MM-DD
  quantidade: number;
  marketplace: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  client_id: string;
  client_nome: string | null;
}

export interface EcommerceAggregate {
  kpis: { total: number; clientes: number; assessores: number; dias: number };
  porAssessor: { id: string; nome: string; total: number }[];
  porCliente: { id: string; nome: string; total: number }[];
  porMarketplace: { marketplace: string; total: number }[];
  porTempo: { data: string; total: number }[];
}

function somaDesc(
  map: Map<string, { nome: string; total: number }>,
): { id: string; nome: string; total: number }[] {
  return [...map.entries()]
    .map(([id, v]) => ({ id, nome: v.nome, total: v.total }))
    .sort((a, b) => b.total - a.total);
}

export function aggregateAnuncios(rows: AnuncioAggRow[]): EcommerceAggregate {
  const assessor = new Map<string, { nome: string; total: number }>();
  const cliente = new Map<string, { nome: string; total: number }>();
  const marketplace = new Map<string, number>();
  const tempo = new Map<string, number>();
  let total = 0;

  for (const r of rows) {
    const q = r.quantidade;
    total += q;

    const aId = r.colaborador_id ?? "sem";
    const aNome = r.colaborador_id ? (r.colaborador_nome ?? "—") : "Sem assessor";
    const a = assessor.get(aId);
    if (a) a.total += q;
    else assessor.set(aId, { nome: aNome, total: q });

    const c = cliente.get(r.client_id);
    if (c) c.total += q;
    else cliente.set(r.client_id, { nome: r.client_nome ?? "—", total: q });

    marketplace.set(r.marketplace, (marketplace.get(r.marketplace) ?? 0) + q);
    tempo.set(r.data, (tempo.get(r.data) ?? 0) + q);
  }

  return {
    kpis: {
      total,
      clientes: cliente.size,
      assessores: assessor.size,
      dias: tempo.size,
    },
    porAssessor: somaDesc(assessor),
    porCliente: somaDesc(cliente),
    porMarketplace: [...marketplace.entries()]
      .map(([marketplace, total]) => ({ marketplace, total }))
      .sort((a, b) => b.total - a.total),
    porTempo: [...tempo.entries()]
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => a.data.localeCompare(b.data)),
  };
}
