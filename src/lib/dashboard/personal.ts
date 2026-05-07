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
    // Tarefas tipo arte/video passam pelo fluxo de aprovação e terminam em
    // postada/aprovada (raramente concluida). Tipo geral termina em concluida.
    // Filtramos todos os estados "entregues" e fazemos a soma em JS pra poder
    // resolver a data certa por estado (completed_at p/ postada+concluida,
    // aprovada_em p/ aprovada/em_aprovacao).
    interface Row {
      tipo: string | null;
      status: string;
      artes_entregues: number | null;
      completed_at: string | null;
      aprovada_em: string | null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("tasks")
      .select("tipo, status, artes_entregues, completed_at, aprovada_em")
      .eq("atribuido_a", userId)
      .in("status", ["concluida", "postada", "aprovada", "em_aprovacao"]);
    const rows = (data ?? []) as Row[];

    let total = 0;
    for (const r of rows) {
      // Data efetiva da entrega por estado:
      // - postada/concluida: completed_at é o stamp final
      // - aprovada: aprovada_em (quando o aprovador aprovou)
      // - em_aprovacao: aprovada_em ainda não existe; cai no fallback abaixo
      let deliveredAt: string | null = null;
      if (r.status === "postada" || r.status === "concluida") {
        deliveredAt = r.completed_at;
      } else if (r.status === "aprovada") {
        deliveredAt = r.aprovada_em ?? r.completed_at;
      } else if (r.status === "em_aprovacao") {
        // Sem timestamp explícito de "entregue"; ignora por enquanto
        // (designer ainda vai ver depois que aprovador aprovar/postar).
        continue;
      }
      if (!deliveredAt || deliveredAt < fromIso || deliveredAt >= toIso) continue;

      // Tipo arte/video conta como pelo menos 1 (cada task é uma entrega);
      // tipo geral só conta o que o designer informou explicitamente.
      const isArtType = r.tipo === "arte" || r.tipo === "video";
      const value = isArtType ? (r.artes_entregues ?? 1) : (r.artes_entregues ?? 0);
      total += value;
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
    ["dashboard-personal-producao"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso, k: kind }));
}
