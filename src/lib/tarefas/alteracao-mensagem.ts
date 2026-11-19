// Módulo puro (sem "server-only") pra poder ser testado isoladamente.

/** Ids únicos dos envolvidos, sem vazios e sem quem disparou a ação. */
export function destinatariosAlteracao(
  ids: Array<string | null | undefined>,
  actorId: string | null | undefined,
): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id && id !== actorId)));
}

/** Texto do lembrete de WhatsApp quando uma tarefa volta pra "Alteração". */
export function mensagemWppAlteracao(args: {
  nome: string | null | undefined;
  titulo: string;
  clienteNome: string | null | undefined;
  motivo: string | null | undefined;
  url: string;
}): string {
  const primeiroNome = (args.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const cliente = args.clienteNome ? ` (${args.clienteNome})` : "";
  const motivo = (args.motivo ?? "").trim();
  const motivoCurto = motivo.length > 500 ? `${motivo.slice(0, 497)}...` : motivo;

  const lines = [
    `✏️ *Tem alteração pra você!*`,
    ``,
    `${primeiroNome ? `${primeiroNome}, a` : "A"} tarefa *${args.titulo}*${cliente} voltou pra alteração.`,
  ];
  if (motivoCurto) {
    lines.push(``, `📝 *O que mudar:* ${motivoCurto}`);
  }
  lines.push(``, `🔗 ${args.url}`);
  return lines.join("\n");
}
