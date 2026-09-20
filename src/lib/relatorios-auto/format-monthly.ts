import type { MonthlyData } from "./monthly-data";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function mesLabel(ym: string): string {
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]}/${y}`;
}

export function formatMonthlyConsolidado(data: MonthlyData): string {
  const { kpis } = data;

  const header = `\u{1F4C8} *Relatorio Mensal — ${mesLabel(data.mesRef)}*`;

  const financeiro = [
    `\n\u{1F4B0} *Financeiro*`,
    `- Carteira ativa: ${formatCurrency(kpis.carteiraAtiva.valor)} (${kpis.carteiraAtiva.deltaValor >= 0 ? "+" : ""}${formatCurrency(kpis.carteiraAtiva.deltaValor)})`,
    `- Clientes ativos: ${kpis.clientesAtivos.quantidade} (${kpis.clientesAtivos.deltaQuantidade >= 0 ? "+" : ""}${kpis.clientesAtivos.deltaQuantidade})`,
    `- Ticket medio: ${formatCurrency(kpis.ticketMedio.valor)}`,
    kpis.ltv.valor !== null ? `- LTV: ${formatCurrency(kpis.ltv.valor)}` : null,
  ].filter(Boolean).join("\n");

  const churn = [
    `\n\u{1F6A8} *Churn*`,
    `- Clientes perdidos: ${kpis.churnMes.quantidade}`,
    `- Valor perdido: ${formatCurrency(kpis.churnMes.valorPerdido)}`,
    `- Taxa de churn: ${kpis.ltv.churnRatePct.toFixed(1)}%`,
  ].join("\n");

  const entradaChurnBlock = data.entradaChurn.length > 0
    ? [
        `\n\u{1F4C5} *Entrada vs Churn (ultimos 3 meses)*`,
        ...data.entradaChurn.map((ec) =>
          `- ${mesLabel(ec.mes)}: +${ec.entradas} entradas, -${ec.churns} churns${ec.avulsos > 0 ? `, ${ec.avulsos} avulsos` : ""}`,
        ),
      ].join("\n")
    : "";

  const carteira = data.carteiraPorAssessor.length > 0
    ? [
        `\n\u{1F465} *Carteira por Assessor*`,
        ...data.carteiraPorAssessor.slice(0, 10).map((a) =>
          `- ${a.assessorNome}: ${a.qtdClientes} clientes, ${formatCurrency(a.valorTotal)} (${a.pctDoTotal.toFixed(0)}%)`,
        ),
      ].join("\n")
    : "";

  const pontuais = kpis.servicosPontuais.ativos > 0
    ? `\n\u{1F4E6} *Pontuais*\n- Ativos: ${kpis.servicosPontuais.ativos} (${formatCurrency(kpis.servicosPontuais.valorTotal)})\n- Concluidos no mes: ${kpis.servicosPontuais.concluidosMes}`
    : "";

  return [header, financeiro, churn, entradaChurnBlock, carteira, pontuais]
    .filter(Boolean)
    .join("\n");
}
