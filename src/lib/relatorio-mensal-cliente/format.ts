import type { ClientMonthlyMetrics } from "./queries";

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function variacao(atual: number, anterior: number): string {
  if (anterior === 0) return "";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  const sign = pct > 0 ? "+" : "";
  const icon = pct >= 0 ? "📈" : "📉";
  return ` ${icon} ${sign}${pct}%`;
}

function mesNome(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[m]} ${y}`;
}

export function formatRelatorioMensalCliente(
  data: ClientMonthlyMetrics,
  mesRef: string,
): string {
  const m = data.metricas;
  const prev = data.metricasMesAnterior;

  const formatoLines: string[] = [];
  if (data.postsPorFormato.feed > 0) formatoLines.push(`   Feed: ${data.postsPorFormato.feed}`);
  if (data.postsPorFormato.reel > 0) formatoLines.push(`   Reels: ${data.postsPorFormato.reel}`);
  if (data.postsPorFormato.story > 0) formatoLines.push(`   Stories: ${data.postsPorFormato.story}`);

  return [
    `📊 *Relatório Mensal — ${mesNome(mesRef)}*`,
    ``,
    `Olá! Aqui está o resumo de performance do mês da *${data.clienteNome}*:`,
    ``,
    `📝 *Conteúdo publicado:* ${data.postsPublicados} posts`,
    ...formatoLines,
    ``,
    `📈 *Métricas do mês:*`,
    `👁️ Alcance: ${fmtNum(m.alcance)}${variacao(m.alcance, prev.alcance)}`,
    `❤️ Curtidas: ${fmtNum(m.curtidas)}${variacao(m.curtidas, prev.curtidas)}`,
    `💬 Comentários: ${fmtNum(m.comentarios)}${variacao(m.comentarios, prev.comentarios)}`,
    `🔖 Salvamentos: ${fmtNum(m.salvamentos)}${variacao(m.salvamentos, prev.salvamentos)}`,
    `🔄 Compartilhamentos: ${fmtNum(m.compartilhamentos)}${variacao(m.compartilhamentos, prev.compartilhamentos)}`,
    ``,
    `🎯 *Engajamento total:* ${fmtNum(m.engajamento)}${variacao(m.engajamento, prev.engajamento)}`,
    ``,
    `Qualquer dúvida, estamos à disposição! 🚀`,
  ].join("\n");
}
