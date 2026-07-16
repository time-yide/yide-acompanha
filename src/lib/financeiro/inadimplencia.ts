// SERVER ONLY: não importar de client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface DevedorRow {
  client_id: string;
  nome: string;
  /** Nº de meses em aberto. */
  meses: number;
  /** meses × valor_mensal (aproximado — client_payments só guarda status). */
  valor: number;
}

export interface InadimplenciaData {
  totalEmAberto: number;
  /** % do total em aberto sobre a receita mensal ativa (comum). */
  pctReceita: number;
  qtdClientes: number;
  qtdMeses: number;
  devedores: DevedorRow[];
  /** true quando a tabela client_payments ainda não existe (migration não aplicada). */
  indisponivel: boolean;
}

const VAZIO: InadimplenciaData = {
  totalEmAberto: 0,
  pctReceita: 0,
  qtdClientes: 0,
  qtdMeses: 0,
  devedores: [],
  indisponivel: true,
};

/**
 * Inadimplência atual = pagamentos com status 'pendente' em client_payments,
 * de clientes ATIVOS comuns. Valor em aberto = meses pendentes × valor_mensal
 * (aproximação; a tabela só guarda status). Resiliente: se a tabela ainda não
 * existe (migration de pagamentos não aplicada), devolve indisponivel=true em
 * vez de quebrar a página.
 */
export async function getInadimplencia(): Promise<InadimplenciaData> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;

    const { data: pend, error } = await sb
      .from("client_payments")
      .select("client_id, status")
      .eq("status", "pendente");
    if (error) return VAZIO; // tabela inexistente / schema cache → indisponível

    const pendRows = (pend ?? []) as Array<{ client_id: string }>;
    if (pendRows.length === 0) return { ...VAZIO, indisponivel: false };

    const clientIds = [...new Set(pendRows.map((r) => r.client_id))];
    const { data: clientesData } = await sb
      .from("clients")
      .select("id, nome, valor_mensal, status, tipo_relacao, deleted_at")
      .in("id", clientIds);

    const info = new Map<string, { nome: string; valor: number; ok: boolean }>();
    for (const c of (clientesData ?? []) as Array<{
      id: string;
      nome: string;
      valor_mensal: number | null;
      status: string | null;
      tipo_relacao: string | null;
      deleted_at: string | null;
    }>) {
      info.set(c.id, {
        nome: c.nome,
        valor: Number(c.valor_mensal) || 0,
        ok: c.status === "ativo" && c.tipo_relacao === "comum" && !c.deleted_at,
      });
    }

    const byClient = new Map<string, { nome: string; meses: number; valor: number }>();
    for (const r of pendRows) {
      const i = info.get(r.client_id);
      if (!i || !i.ok) continue;
      const cur = byClient.get(r.client_id) ?? { nome: i.nome, meses: 0, valor: 0 };
      cur.meses += 1;
      cur.valor += i.valor;
      byClient.set(r.client_id, cur);
    }

    const devedores = [...byClient.entries()]
      .map(([client_id, v]) => ({ client_id, ...v }))
      .sort((a, b) => b.valor - a.valor);

    const totalEmAberto = devedores.reduce((s, d) => s + d.valor, 0);
    const qtdMeses = devedores.reduce((s, d) => s + d.meses, 0);

    const { data: ativos } = await sb
      .from("clients")
      .select("valor_mensal")
      .eq("status", "ativo")
      .eq("tipo_relacao", "comum")
      .is("deleted_at", null);
    const receita = ((ativos ?? []) as Array<{ valor_mensal: number | null }>).reduce(
      (s, c) => s + (Number(c.valor_mensal) || 0),
      0,
    );

    return {
      totalEmAberto,
      pctReceita: receita > 0 ? (totalEmAberto / receita) * 100 : 0,
      qtdClientes: devedores.length,
      qtdMeses,
      devedores: devedores.slice(0, 8),
      indisponivel: false,
    };
  } catch {
    return VAZIO;
  }
}
