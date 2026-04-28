// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import { isInMonth, monthRange, lastDayOfMonth } from "./date-utils";

interface ClientRow {
  id: string;
  valor_mensal: number;
  data_entrada: string;
  data_churn: string | null;
  status: string;
}

export interface KpiData {
  carteiraAtiva: { valor: number; deltaValor: number };
  clientesAtivos: { quantidade: number; deltaQuantidade: number };
  churnMes: { quantidade: number; valorPerdido: number };
  custoComissaoPct: { pct: number };
}

function isActiveOn(c: ClientRow, dateIso: string): boolean {
  // Cliente está ativo no dia X se entrou até X e (não churnou OU churnou depois de X)
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

export async function getKpis(now: Date = new Date()): Promise<KpiData> {
  const supabase = await createClient();
  const monthRef = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().slice(0, 10);

  // Calcular última data do mês ANTERIOR (para delta)
  const prevMonthLastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, status")
    .eq("status", "ativo");

  const allClients = (clientsData ?? []) as ClientRow[];

  const ativosHoje = allClients.filter((c) => isActiveOn(c, todayIso));
  const ativosFimMesAnterior = allClients.filter((c) => isActiveOn(c, prevMonthLastDay));

  const carteiraAtivaValor = ativosHoje.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const carteiraMesAnteriorValor = ativosFimMesAnterior.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  const churnsDoMes = allClients.filter((c) => isInMonth(c.data_churn, monthRef));
  const valorChurnado = churnsDoMes.reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  // Custo de comissão = soma do último commission_snapshot dividida pela carteira ativa
  const { data: snapshotsData } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia, valor_total")
    .order("mes_referencia", { ascending: false })
    .limit(50); // pega vários do mesmo mês mais recente
  const snapshots = (snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>;
  const ultimoMes = snapshots[0]?.mes_referencia;
  const totalComissao = ultimoMes
    ? snapshots.filter((s) => s.mes_referencia === ultimoMes).reduce((a, s) => a + Number(s.valor_total), 0)
    : 0;
  const pctComissao = carteiraAtivaValor > 0 ? (totalComissao / carteiraAtivaValor) * 100 : 0;

  return {
    carteiraAtiva: {
      valor: carteiraAtivaValor,
      deltaValor: carteiraAtivaValor - carteiraMesAnteriorValor,
    },
    clientesAtivos: {
      quantidade: ativosHoje.length,
      deltaQuantidade: ativosHoje.length - ativosFimMesAnterior.length,
    },
    churnMes: {
      quantidade: churnsDoMes.length,
      valorPerdido: valorChurnado,
    },
    custoComissaoPct: {
      pct: pctComissao,
    },
  };
}

export interface TimelinePoint {
  mes: string;          // 'YYYY-MM'
  valorTotal: number;
}

export async function getCarteiraTimeline(
  months: number = 12,
  now: Date = new Date(),
): Promise<TimelinePoint[]> {
  const supabase = await createClient();
  const meses = monthRange(months, now);

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    data_entrada: string;
    data_churn: string | null;
  }>;

  return meses.map((mes) => {
    const fimDoMes = lastDayOfMonth(mes);
    const ativos = clients.filter((c) => {
      if (c.data_entrada > fimDoMes) return false;
      if (c.data_churn && c.data_churn <= fimDoMes) return false;
      return true;
    });
    const valorTotal = ativos.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return { mes, valorTotal };
  });
}
