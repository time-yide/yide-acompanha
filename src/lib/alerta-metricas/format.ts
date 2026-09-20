import type { ClientMetricsComparison } from "./queries";

function fmtVar(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v}%`;
}

function metricaLine(label: string, atual: number, variacao: number): string {
  const icon = variacao <= -25 ? "🔴" : variacao < 0 ? "🟡" : "🟢";
  return `${icon} ${label}: ${atual.toLocaleString("pt-BR")} (${fmtVar(variacao)})`;
}

function formatClient(c: ClientMetricsComparison): string {
  return [
    `📉 *${c.clienteNome}*`,
    metricaLine("Alcance", c.semanaAtual.alcance, c.variacao.alcance),
    metricaLine("Curtidas", c.semanaAtual.curtidas, c.variacao.curtidas),
    metricaLine("Comentários", c.semanaAtual.comentarios, c.variacao.comentarios),
    metricaLine("Salvamentos", c.semanaAtual.salvamentos, c.variacao.salvamentos),
    metricaLine("Engajamento total", c.semanaAtual.engajamento, c.variacao.engajamento),
  ].join("\n");
}

export function formatAlertaQueda(
  assessorNome: string,
  clients: ClientMetricsComparison[],
): string {
  const nome = assessorNome.split(" ")[0];
  const count = clients.length;

  return [
    `⚠️ *Alerta de Queda de Métricas*`,
    ``,
    `Oi ${nome}, ${count} cliente${count !== 1 ? "s" : ""} teve queda significativa essa semana:`,
    ``,
    clients.map(formatClient).join("\n\n"),
    ``,
    `Analise os conteúdos recentes e ajuste a estratégia.`,
  ].join("\n");
}
