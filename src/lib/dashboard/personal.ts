// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type Periodo = "mes_atual" | "mes_anterior" | "dias_7" | "total";

export function resolvePeriodo(periodo: Periodo, reference: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const ref = new Date(reference);
  if (periodo === "mes_anterior") {
    const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }
  if (periodo === "dias_7") {
    const from = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { fromIso: from.toISOString(), toIso: ref.toISOString() };
  }
  if (periodo === "total") {
    return { fromIso: "1970-01-01T00:00:00.000Z", toIso: "2999-12-31T23:59:59.999Z" };
  }
  // default: mes_atual
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

// ─── getMinhasTarefasPendentes ───────────────────────────────────────────────

export interface TarefaPendenteRow {
  id: string;
  titulo: string;
  prioridade: string | null;
  due_date: string | null;
  status: string;
  cliente_nome: string | null;
}

export async function _getMinhasTarefasPendentesImpl(userId: string): Promise<TarefaPendenteRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("tasks")
    .select(`
      id, titulo, prioridade, due_date, status,
      cliente:clients(nome)
    `)
    .neq("status", "concluida")
    .or(`atribuido_a.eq.${userId},participantes_ids.cs.{${userId}}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  return ((data ?? []) as Array<{
    id: string;
    titulo: string;
    prioridade: string | null;
    due_date: string | null;
    status: string;
    cliente: { nome: string } | null;
  }>).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    prioridade: r.prioridade,
    due_date: r.due_date,
    status: r.status,
    cliente_nome: r.cliente?.nome ?? null,
  }));
}

export async function getMinhasTarefasPendentes(userId: string): Promise<TarefaPendenteRow[]> {
  const cached = unstable_cache(
    async (uid: string) => _getMinhasTarefasPendentesImpl(uid),
    ["dashboard-personal-tarefas-pendentes"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(userId);
}

// ─── getProximasGravacoes ────────────────────────────────────────────────────

export interface GravacaoRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  localizacao_endereco: string | null;
}

export async function _getProximasGravacoesImpl(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<GravacaoRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, localizacao_endereco")
    .eq("sub_calendar", "videomakers")
    .contains("participantes_ids", [userId])
    .gte("inicio", fromIso)
    .lte("inicio", toIso)
    .order("inicio", { ascending: true });

  return (data ?? []) as GravacaoRow[];
}

export async function getProximasGravacoes(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<GravacaoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, from, to } = JSON.parse(paramsJson) as { uid: string; from: string; to: string };
      return _getProximasGravacoesImpl(uid, from, to);
    },
    ["dashboard-personal-gravacoes"],
    { revalidate: 60, tags: ["dashboard", "calendar"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso }));
}

// ─── getProducaoNoPeriodo ────────────────────────────────────────────────────

export async function _getProducaoNoPeriodoImpl(
  userId: string,
  fromIso: string,
  toIso: string,
  kind: "artes" | "tarefas",
): Promise<number> {
  const supabase = createServiceRoleClient();

  if (kind === "artes") {
    // "Artes entregues" = quantas vezes o designer mandou pra aprovação no
    // período. A tabela task_revisoes registra um row tipo='envio' a cada
    // submitForApprovalAction — esse é o stamp exato de "entreguei".
    //
    // Cada envio conta como `task.artes_entregues` (quando preenchido)
    // ou 1 por padrão pra arte/video. Geral cai no caminho "tarefas".
    //
    // Reenvios após ajustes contam como entregas separadas (designer
    // entregou de novo).
    interface Row {
      criado_em: string;
      task: { tipo: string | null; artes_entregues: number | null } | null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("task_revisoes")
      .select("criado_em, task:tasks!task_revisoes_task_id_fkey(tipo, artes_entregues)")
      .eq("autor_id", userId)
      .eq("tipo", "envio")
      .gte("criado_em", fromIso)
      .lt("criado_em", toIso);
    const rows = (data ?? []) as Row[];

    let total = 0;
    for (const r of rows) {
      const tipo = r.task?.tipo ?? null;
      const artes = r.task?.artes_entregues;
      // Só conta se a task é tipo arte/video — fluxo de aprovação faz sentido
      // pra esses dois tipos. Tasks geral não chegam aqui (não geram envio).
      if (tipo !== "arte" && tipo !== "video") continue;
      total += artes ?? 1;
    }
    return total;
  }

  // kind === "tarefas" — conta por completed_at (stamp em concluida e postada).
  // Cast porque os types do Supabase ainda não conhecem o status "postada".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("atribuido_a", userId)
    .in("status", ["concluida", "postada"])
    .gte("completed_at", fromIso)
    .lt("completed_at", toIso);
  return count ?? 0;
}

export async function getProducaoNoPeriodo(
  userId: string,
  fromIso: string,
  toIso: string,
  kind: "artes" | "tarefas",
): Promise<number> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, from, to, k } = JSON.parse(paramsJson) as {
        uid: string; from: string; to: string; k: "artes" | "tarefas";
      };
      return _getProducaoNoPeriodoImpl(uid, from, to, k);
    },
    // v2: nova lógica de contagem via task_revisoes (envio) pra "artes".
    ["dashboard-personal-producao-v2"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso, k: kind }));
}
