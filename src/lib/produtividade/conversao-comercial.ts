// Puro/testável — conversão comercial: de ligação a lead, por assessor.
// Mede resultado, não só esforço (ligar muito sem gerar lead não é produtivo).

export interface ConversaoPessoa {
  user_id: string;
  ligacoes: number; // ligações de saída no período
  leads: number;    // dessas, quantas geraram um lead (lead_gerado_id)
}

export interface ConversaoRow extends ConversaoPessoa {
  nome: string;
}

export function computeConversao(rows: Array<{ colaborador_id: string | null; temLead: boolean }>): ConversaoPessoa[] {
  const map = new Map<string, { ligacoes: number; leads: number }>();
  for (const r of rows) {
    if (!r.colaborador_id) continue;
    const cur = map.get(r.colaborador_id) ?? { ligacoes: 0, leads: 0 };
    cur.ligacoes += 1;
    if (r.temLead) cur.leads += 1;
    map.set(r.colaborador_id, cur);
  }
  return [...map.entries()]
    .map(([user_id, c]) => ({ user_id, ...c }))
    .sort((a, b) => b.leads - a.leads || b.ligacoes - a.ligacoes);
}

export function taxaConversao(leads: number, ligacoes: number): number | null {
  return ligacoes > 0 ? Math.round((leads / ligacoes) * 100) : null;
}
