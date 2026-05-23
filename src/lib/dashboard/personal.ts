// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAppTimezoneOffsetMs, getDatePartsInAppTz } from "@/lib/datetime/timezone";

export type Periodo = "mes_atual" | "mes_anterior" | "dias_7" | "total";

/**
 * Constrói o ISO UTC pra "início do dia 1 do mês YYYY-MM no fuso da app".
 * Ex.: mês "2026-05" → "2026-05-01 00:00 America/Cuiaba" → ISO UTC.
 */
function monthStartIso(year: number, monthIndex0: number): string {
  // pivô às 12h UTC pra evitar bordas de DST hipotéticas
  const pivot = new Date(Date.UTC(year, monthIndex0, 1, 12, 0, 0));
  const offsetMs = getAppTimezoneOffsetMs(pivot);
  const utcMs = Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0) + offsetMs;
  return new Date(utcMs).toISOString();
}

export function resolvePeriodo(periodo: Periodo, reference: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const ref = new Date(reference);
  const parts = getDatePartsInAppTz(ref);
  const year = parseInt(parts.year, 10);
  const monthIndex0 = parseInt(parts.month, 10) - 1; // 0-11 no fuso da app
  if (periodo === "mes_anterior") {
    const fromIso = monthStartIso(year, monthIndex0 - 1);
    const toIso = monthStartIso(year, monthIndex0);
    return { fromIso, toIso };
  }
  if (periodo === "dias_7") {
    const from = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { fromIso: from.toISOString(), toIso: ref.toISOString() };
  }
  if (periodo === "total") {
    return { fromIso: "1970-01-01T00:00:00.000Z", toIso: "2999-12-31T23:59:59.999Z" };
  }
  // default: mes_atual
  const fromIso = monthStartIso(year, monthIndex0);
  const toIso = monthStartIso(year, monthIndex0 + 1);
  return { fromIso, toIso };
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
  // `deleted_at is null` filtra "demandas fantasma" - tarefas soft-deleted que
  // continuavam aparecendo no card "Tarefas pendentes" mesmo depois do criador
  // ter mandado pra /lixeira.
  const { data } = await supabase
    .from("tasks")
    .select(`
      id, titulo, prioridade, due_date, status,
      cliente:clients(nome)
    `)
    .is("deleted_at", null)
    .in("status", ["aberta", "em_andamento", "alteracao"])
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

  // Conta entregas operacionais de qualquer tipo de task. Estados que
  // contabilizam:
  //   - concluida (geral): completed_at é o stamp
  //   - aprovada (arte/video): aprovada_em é o stamp
  //   - postada (arte/video, depois de aprovada): completed_at é o stamp
  // Estados que NÃO contam:
  //   - em_aprovacao (aguardando validação) - material entregue mas não
  //     aprovado ainda
  //   - em_andamento / aberta - não terminou
  //
  // Quando aprovador pede ajustes, task volta pra em_andamento - query
  // dinâmica deixa de contar automaticamente. Re-aprovação atualiza
  // aprovada_em pro novo momento (approveTaskAction sempre seta now).
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
    .is("deleted_at", null)
    .eq("atribuido_a", userId)
    .in("status", ["concluida", "aprovada", "postada"]);
  const rows = (data ?? []) as Row[];

  let totalArtes = 0;
  let totalTarefas = 0;
  for (const r of rows) {
    let deliveredAt: string | null = null;
    if (r.status === "concluida") deliveredAt = r.completed_at;
    else if (r.status === "aprovada") deliveredAt = r.aprovada_em ?? r.completed_at;
    else if (r.status === "postada") deliveredAt = r.completed_at ?? r.aprovada_em;
    if (!deliveredAt || deliveredAt < fromIso || deliveredAt >= toIso) continue;

    totalTarefas += 1;

    // Tipo arte/video: cada task entregue = artes_entregues || 1
    // Tipo geral: só conta artes se o designer informou explicitamente
    const isArtType = r.tipo === "arte" || r.tipo === "video";
    if (isArtType) {
      totalArtes += r.artes_entregues ?? 1;
    } else if (r.artes_entregues) {
      totalArtes += r.artes_entregues;
    }
  }

  return kind === "artes" ? totalArtes : totalTarefas;
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
    // v3: conta por status terminal real (concluida/aprovada/postada).
    // Considera ajustes/revisões: task em em_andamento (após pedido de
    // ajuste) deixa de contar até voltar pra aprovada/postada.
    ["dashboard-personal-producao-v3"],
    { revalidate: 60, tags: ["dashboard", "tasks"] },
  );
  return cached(JSON.stringify({ uid: userId, from: fromIso, to: toIso, k: kind }));
}
