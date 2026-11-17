import type { TarefaAtrasada, UserOverdueTasks } from "./queries";

function diasAtraso(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate + "T12:00:00");
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function prioridadeIcon(p: string): string {
  if (p === "alta") return "🔴";
  if (p === "media") return "🟡";
  return "🟢";
}

function formatTarefa(t: TarefaAtrasada): string {
  const dias = diasAtraso(t.due_date);
  const cliente = t.cliente_nome ? ` — ${t.cliente_nome}` : "";
  return `${prioridadeIcon(t.prioridade)} *${t.titulo}*${cliente}\n   Prazo: ${t.due_date} (${dias} dia${dias !== 1 ? "s" : ""} atrás)`;
}

export function formatLembreteTarefas(user: UserOverdueTasks, appUrl: string): string {
  const sorted = [...user.tarefas].sort((a, b) => {
    const prio = { alta: 0, media: 1, baixa: 2 } as Record<string, number>;
    return (prio[a.prioridade] ?? 1) - (prio[b.prioridade] ?? 1);
  });

  const count = sorted.length;
  const lines = sorted.map(formatTarefa).join("\n\n");

  return [
    `⚠️ *Tarefas Atrasadas*`,
    ``,
    `Oi ${user.nome.split(" ")[0]}, você tem *${count}* tarefa${count !== 1 ? "s" : ""} atrasada${count !== 1 ? "s" : ""}:`,
    ``,
    lines,
    ``,
    `📎 ${appUrl}/tarefas?prazo=vencidas`,
  ].join("\n");
}
