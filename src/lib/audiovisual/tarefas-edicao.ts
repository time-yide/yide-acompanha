// Criação das tarefas de edição de uma captação (auto-delegação e delegação
// manual usam o mesmo caminho).
//
// Regras:
//  - Prazo padrão = data da gravação + 3 dias úteis (fixo, ninguém muda).
//  - Com edição urgente: 2 tarefas pro MESMO editor — "URGENTE" (prioridade
//    alta, prazo = data urgente, N vídeos) + normal com o restante. Se todos os
//    vídeos são urgentes, só a urgente.
import { isYmd } from "@/lib/datas/dias-uteis";
import { prazoPadraoDaCaptura } from "./prazo-edicao";
import { formatYmdBr, isErroColunaEdicaoUrgente } from "./edicao-urgente";

export interface CapturaParaEdicao {
  id: string;
  client_id: string;
  drive_url: string | null;
  qtd_videos: number;
  qtd_fotos: number;
  pontos_positivos: string | null;
  pontos_dificuldade: string | null;
  sugestoes: string | null;
  observacoes: string | null;
  data_captacao: string | null;
  task_id: string | null;
  concluida_em?: string | null;
  edicao_urgente?: boolean | null;
  edicao_urgente_data?: string | null;
  edicao_urgente_qtd?: number | null;
  cliente: { id: string; nome: string; assessor_id: string | null } | null;
}

const BASE_COLS = `
  id, client_id, drive_url, qtd_videos, qtd_fotos,
  pontos_positivos, pontos_dificuldade, sugestoes, observacoes,
  task_id, data_captacao, concluida_em,
  cliente:clients(id, nome, assessor_id)
`;

/** Carrega a captação com os campos de urgência (tolera migration não aplicada). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function carregarCapturaParaEdicao(sb: any, capturaId: string): Promise<CapturaParaEdicao | null> {
  let res = await sb
    .from("audiovisual_capturas")
    .select(`${BASE_COLS}, edicao_urgente, edicao_urgente_data, edicao_urgente_qtd`)
    .eq("id", capturaId)
    .maybeSingle();
  if (res.error && isErroColunaEdicaoUrgente(res.error.message)) {
    res = await sb.from("audiovisual_capturas").select(BASE_COLS).eq("id", capturaId).maybeSingle();
  }
  return (res.data as CapturaParaEdicao | null) ?? null;
}

export interface TarefaEdicaoPlano {
  tipo: "normal" | "urgente";
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media";
  due_date: string;
}

export { prazoPadraoDaCaptura };

/** Pura: decide quais tarefas criar (1 ou 2) e com que título/prazo. */
export function planejarTarefasEdicao(c: CapturaParaEdicao, hoje: Date = new Date()): TarefaEdicaoPlano[] {
  const clienteNome = c.cliente?.nome ?? "";
  const dataBr = isYmd(c.data_captacao) ? formatYmdBr(c.data_captacao) : "";
  const sufixo = `${clienteNome}${dataBr ? ` (${dataBr})` : ""}`;
  const prazo = prazoPadraoDaCaptura(c.data_captacao, hoje);

  const extras: string[] = [];
  if (c.drive_url) extras.push(`Drive: ${c.drive_url}`);
  if (c.pontos_positivos) extras.push(`✅ Positivos: ${c.pontos_positivos}`);
  if (c.pontos_dificuldade) extras.push(`⚠️ Dificuldades: ${c.pontos_dificuldade}`);
  if (c.sugestoes) extras.push(`💡 Sugestões: ${c.sugestoes}`);
  if (c.observacoes) extras.push(`Obs.: ${c.observacoes}`);

  const temUrgente =
    c.edicao_urgente === true && isYmd(c.edicao_urgente_data) && (c.edicao_urgente_qtd ?? 0) >= 1;

  if (!temUrgente) {
    return [{
      tipo: "normal",
      titulo: `Editar: ${sufixo}`,
      descricao: [`📹 ${c.qtd_videos} vídeo(s) · 📷 ${c.qtd_fotos} foto(s)`, ...extras].join("\n\n"),
      prioridade: "media",
      due_date: prazo,
    }];
  }

  const qtdUrg = c.qtd_videos > 0 ? Math.min(c.edicao_urgente_qtd!, c.qtd_videos) : c.edicao_urgente_qtd!;
  const restante = Math.max(0, c.qtd_videos - qtdUrg);
  const dataUrg = c.edicao_urgente_data!;

  const urgente: TarefaEdicaoPlano = {
    tipo: "urgente",
    titulo: `URGENTE – Editar: ${sufixo}`,
    descricao: [
      `🔥 ${qtdUrg} vídeo(s) urgente(s) — precisa sair até ${formatYmdBr(dataUrg)}`,
      restante > 0
        ? `Os outros ${restante} vídeo(s) estão na tarefa "Editar: ${sufixo}" (prazo ${formatYmdBr(prazo)}).`
        : `📷 ${c.qtd_fotos} foto(s)`,
      ...extras,
    ].join("\n\n"),
    prioridade: "alta",
    due_date: dataUrg,
  };
  if (restante === 0) return [urgente];

  return [urgente, {
    tipo: "normal",
    titulo: `Editar: ${sufixo}`,
    descricao: [
      `📹 ${restante} vídeo(s) · 📷 ${c.qtd_fotos} foto(s)`,
      `${qtdUrg} vídeo(s) urgente(s) desta gravação estão na tarefa "URGENTE – Editar: ${sufixo}".`,
      ...extras,
    ].join("\n\n"),
    prioridade: "media",
    due_date: prazo,
  }];
}

export interface CriarTarefasArgs {
  atribuido_a: string;
  criado_por: string;
  participantes_ids: string[];
  links?: Array<{ label: string; url: string }>;
}

export type CriarTarefasResult =
  | { ok: true; taskId: string; taskUrgenteId: string | null; planos: TarefaEdicaoPlano[] }
  | { ok: false; error: string; corrida?: boolean };

/**
 * Cria as tarefas e liga na captação (com guarda de corrida: só liga se a
 * captação ainda não tem task_id). Se algo falhar, apaga o que criou.
 */
export async function criarTarefasEdicao(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  captura: CapturaParaEdicao,
  args: CriarTarefasArgs,
): Promise<CriarTarefasResult> {
  const planos = planejarTarefasEdicao(captura);
  const criadas: Array<{ id: string; tipo: TarefaEdicaoPlano["tipo"] }> = [];

  const desfazer = async () => {
    if (criadas.length > 0) await sb.from("tasks").delete().in("id", criadas.map((t) => t.id));
  };

  for (const p of planos) {
    const { data, error } = await sb
      .from("tasks")
      .insert({
        titulo: p.titulo,
        descricao: p.descricao,
        prioridade: p.prioridade,
        status: "aberta",
        atribuido_a: args.atribuido_a,
        criado_por: args.criado_por,
        client_id: captura.client_id,
        due_date: p.due_date,
        participantes_ids: args.participantes_ids,
        ...(args.links ? { links: args.links } : {}),
      })
      .select("id")
      .single();
    if (error || !data) {
      await desfazer();
      return { ok: false, error: error?.message ?? "Falha ao criar tarefa" };
    }
    criadas.push({ id: data.id, tipo: p.tipo });
  }

  const normal = criadas.find((t) => t.tipo === "normal") ?? null;
  const urgente = criadas.find((t) => t.tipo === "urgente") ?? null;
  // task_id = tarefa normal (ou a urgente, quando é a única).
  const taskId = (normal ?? urgente)!.id;
  const taskUrgenteId = normal && urgente ? urgente.id : null;

  const link = (patch: Record<string, unknown>) =>
    sb.from("audiovisual_capturas").update(patch).eq("id", captura.id).is("task_id", null).select("id");

  let res = await link({ task_id: taskId, ...(taskUrgenteId ? { task_urgente_id: taskUrgenteId } : {}) });
  if (res.error && isErroColunaEdicaoUrgente(res.error.message)) {
    res = await link({ task_id: taskId });
  }
  if (res.error || !res.data || res.data.length === 0) {
    await desfazer();
    return res.error
      ? { ok: false, error: res.error.message }
      : { ok: false, error: "Captação já foi delegada", corrida: true };
  }

  return { ok: true, taskId, taskUrgenteId: urgente?.id ?? null, planos };
}
