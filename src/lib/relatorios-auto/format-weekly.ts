import type { WeeklyData, WeeklySectorData } from "./weekly-data";
import type { Setor } from "@/lib/produtividade/setor-metricas";

const SETOR_EMOJI: Record<Setor, string> = {
  comercial: "\u{1F4DE}",
  ecommerce: "\u{1F6D2}",
  assessoria: "\u{1F4CB}",
  design: "\u{1F3A8}",
  audiovisual: "\u{1F3AC}",
  programacao: "\u{1F4BB}",
};

const SETOR_TITULO: Record<Setor, string> = {
  comercial: "Comercial",
  ecommerce: "E-commerce",
  assessoria: "Assessoria",
  design: "Design",
  audiovisual: "Audiovisual",
  programacao: "Programacao",
};

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function pctNoPrazo(noPrazo: number, comPrazo: number): string {
  if (comPrazo <= 0) return "--";
  return `${Math.round((noPrazo / comPrazo) * 100)}%`;
}

function formatSectorBlock(s: WeeklySectorData): string {
  const emoji = SETOR_EMOJI[s.setor] ?? "";
  const titulo = SETOR_TITULO[s.setor] ?? s.setor;
  const lines: string[] = [`${emoji} *${titulo}*`];

  switch (s.setor) {
    case "comercial":
      lines.push(`- Ligacoes: ${s.totals.ligacoes_feitas} (${s.totals.ligacoes_atendidas} atendidas)`);
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.ligacoes_feitas} lig, ${p.tarefas_entregues} entregas`);
      }
      break;
    case "ecommerce":
      lines.push(`- Anuncios: ${s.totals.anuncios}`);
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.anuncios} anuncios, ${p.tarefas_entregues} entregas`);
      }
      break;
    case "assessoria":
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.tarefas_entregues} entregas, ${pctNoPrazo(p.tarefas_no_prazo, p.tarefas_com_prazo)} no prazo`);
      }
      break;
    case "design":
      lines.push(`- Artes aprovadas: ${s.totals.artes}`);
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.artes} artes, ${p.tarefas_entregues} entregas`);
      }
      break;
    case "audiovisual":
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      lines.push(`- Postagens publicadas: ${s.totals.postagens}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.tarefas_entregues} entregas`);
      }
      break;
    case "programacao":
      lines.push(`- Tarefas entregues: ${s.totals.tarefas_entregues}`);
      if (s.totals.tarefas_atrasadas > 0) lines.push(`- Atrasadas: ${s.totals.tarefas_atrasadas}`);
      for (const p of s.pessoas) {
        lines.push(`  ${p.nome}: ${p.tarefas_entregues} entregas`);
      }
      break;
  }

  return lines.join("\n");
}

export function formatWeeklyForSector(data: WeeklyData, setor: Setor): string | null {
  const sectorData = data.setores.find((s) => s.setor === setor);
  if (!sectorData || sectorData.pessoas.length === 0) return null;

  const header = `\u{1F4CA} *Relatorio Semanal — ${SETOR_TITULO[setor]}*\n${formatDate(data.de)} a ${formatDate(data.ate)}\n`;
  const body = formatSectorBlock(sectorData);

  return `${header}\n${body}`;
}

export function formatWeeklyConsolidado(data: WeeklyData): string {
  const header = `\u{1F4CA} *Relatorio Semanal — Consolidado*\n${formatDate(data.de)} a ${formatDate(data.ate)}`;

  const resumo = [
    `\n\u{1F4DD} *Resumo Geral*`,
    `- Tarefas entregues: ${data.totalGeral.tarefas_entregues}`,
    data.totalGeral.tarefas_atrasadas > 0 ? `- Tarefas atrasadas: ${data.totalGeral.tarefas_atrasadas}` : null,
    `- Gravacoes realizadas: ${data.totalGeral.gravacoes_realizadas}`,
    `- Postagens publicadas: ${data.totalGeral.postagens}`,
    `- Artes aprovadas: ${data.totalGeral.artes}`,
    `- Ligacoes feitas: ${data.totalGeral.ligacoes}`,
  ].filter(Boolean).join("\n");

  const setorBlocks = data.setores
    .filter((s) => s.pessoas.length > 0)
    .map((s) => formatSectorBlock(s))
    .join("\n\n");

  return `${header}\n${resumo}\n\n${setorBlocks}`;
}
