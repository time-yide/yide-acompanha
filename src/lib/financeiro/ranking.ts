// SERVER ONLY: não importar de client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface RankingRow {
  nome: string;
  total_investido: number;
  meses_ativos: number;
  primeiro_mes: string;
  ultimo_mes: string;
  ativo: boolean;
}

export interface ClientRankingData {
  porInvestimento: RankingRow[];
  porTempo: RankingRow[];
  totalClientes: number;
  /** true quando a tabela client_ranking ainda não existe (migration não aplicada). */
  indisponivel: boolean;
}

/**
 * Ranking de clientes a partir do snapshot client_ranking (importado das
 * planilhas 2024-2026). Devolve as listas ordenadas por total investido e por
 * tempo de casa (meses ativos). Resiliente: sem a tabela → indisponível.
 */
export async function getClientRanking(limit = 20): Promise<ClientRankingData> {
  const vazio: ClientRankingData = {
    porInvestimento: [],
    porTempo: [],
    totalClientes: 0,
    indisponivel: true,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const { data, error } = await sb
      .from("client_ranking")
      .select("nome, total_investido, meses_ativos, primeiro_mes, ultimo_mes, ativo");
    if (error) return vazio;

    const rows = ((data ?? []) as Array<{
      nome: string;
      total_investido: number | null;
      meses_ativos: number | null;
      primeiro_mes: string;
      ultimo_mes: string;
      ativo: boolean | null;
    }>).map((r) => ({
      nome: r.nome,
      total_investido: Number(r.total_investido) || 0,
      meses_ativos: Number(r.meses_ativos) || 0,
      primeiro_mes: r.primeiro_mes,
      ultimo_mes: r.ultimo_mes,
      ativo: !!r.ativo,
    }));

    const porInvestimento = [...rows]
      .sort((a, b) => b.total_investido - a.total_investido)
      .slice(0, limit);
    const porTempo = [...rows]
      .sort((a, b) => b.meses_ativos - a.meses_ativos || b.total_investido - a.total_investido)
      .slice(0, limit);

    return { porInvestimento, porTempo, totalClientes: rows.length, indisponivel: false };
  } catch {
    return vazio;
  }
}
