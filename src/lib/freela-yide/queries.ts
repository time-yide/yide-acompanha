// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calcularPontos } from "./pontos";
import { agregarPagamentos, type MesPagamentos, type PagamentoInput } from "./pagamentos";
import type { ConquistaStats } from "./conquistas";
import type { StatusOp, TipoOp } from "./tipos";

export interface OportunidadeRow {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_nome: string | null;
  contato: string | null;
  horario: string | null;
  data_hora: string | null;
  duracao_min: number;
  valor_comissao: number;
  status: StatusOp;
  tipo: TipoOp;
  entrega_urgente: boolean;
  prazo_entrega: string | null;
  pego_por: string | null;
  pego_por_nome: string | null;
  pego_em: string | null;
  negociacao_em: string | null;
  fechada_em: string | null;
  created_at: string;
  pontos: number;
}

export interface MetaRow {
  id: string;
  mes: string;
  descricao: string;
  tipo_alvo: "pontos" | "fechamentos" | "comissao";
  alvo: number;
  bonus_descricao: string | null;
}

/** Uma oportunidade que a pessoa pegou (para expandir no ranking). */
export interface RankingItem {
  titulo: string;
  status: StatusOp;
  cliente_nome: string | null;
  valor_comissao: number;
  pego_em: string;
}

export interface RankingEntry {
  user_id: string;
  nome: string;
  pontos: number;
  fechamentos: number;
  comissao: number;       // R$ só das fechadas
  /** R$ de tudo que a pessoa pegou (fechado ou não). Preenchido só em getHistorico. */
  valorPego?: number;
  /** Eventos/oportunidades que a pessoa pegou. Preenchido só em getHistorico. */
  itens?: RankingItem[];
}

/** Entrada do ranking acumulado ("de todos os tempos"): inclui total de freelas pegas. */
export interface RankingGeralEntry extends RankingEntry {
  pegas: number;
}

/** Ranking de um mês fechado. `chave` = "AAAA-MM", `label` = "Julho 2026". */
export interface MesRanking {
  chave: string;
  label: string;
  ranking: RankingEntry[];
}

/** Histórico completo: ranking mês a mês (recente primeiro) + acumulado geral. */
export interface FreelaHistorico {
  meses: MesRanking[];
  geral: RankingGeralEntry[];
}

export interface FreelaStats {
  disponiveis: number;
  comissaoEmJogo: number;   // soma valor_comissao das disponíveis
  ganhoNoMes: number;       // comissão de fechadas no mês (por pego_em) do usuário
  meusPontos: number;
  meuRank: number | null;
  totalNoRanking: number;
}

const SELECT =
  "id, titulo, descricao, cliente_nome, contato, horario, data_hora, duracao_min, valor_comissao, status, tipo, entrega_urgente, prazo_entrega, pego_por, pego_em, negociacao_em, fechada_em, created_at, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)";

function mapRow(row: Record<string, unknown>): OportunidadeRow {
  const status = row.status as StatusOp;
  const valor_comissao = Number(row.valor_comissao ?? 0);
  const base = {
    id: row.id as string,
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? null,
    cliente_nome: (row.cliente_nome as string | null) ?? null,
    contato: (row.contato as string | null) ?? null,
    horario: (row.horario as string | null) ?? null,
    data_hora: (row.data_hora as string | null) ?? null,
    duracao_min: Number(row.duracao_min ?? 60),
    valor_comissao,
    status,
    tipo: (row.tipo as TipoOp) ?? "captacao",
    entrega_urgente: Boolean(row.entrega_urgente ?? false),
    prazo_entrega: (row.prazo_entrega as string | null) ?? null,
    pego_por: (row.pego_por as string | null) ?? null,
    pego_por_nome: ((row.responsavel as { nome?: string } | null) ?? null)?.nome ?? null,
    pego_em: (row.pego_em as string | null) ?? null,
    negociacao_em: (row.negociacao_em as string | null) ?? null,
    fechada_em: (row.fechada_em as string | null) ?? null,
    created_at: row.created_at as string,
  };
  return { ...base, pontos: calcularPontos({ status, negociacao_em: base.negociacao_em, fechada_em: base.fechada_em, valor_comissao }) };
}

function inicioDoMes(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function getOrganizationId(userId: string): Promise<string | null> {
  const sb = createServiceRoleClient() as unknown as { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return ((data as { organization_id?: string } | null) ?? null)?.organization_id ?? null;
}

export async function listOportunidades(orgId: string, apenasDisponiveis = false): Promise<OportunidadeRow[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = sb.from("freela_oportunidades").select(SELECT).eq("organization_id", orgId).is("deleted_at", null);
  if (apenasDisponiveis) q = q.eq("status", "disponivel");
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) { console.error("[freelayide] listOportunidades", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function listMinhas(orgId: string, userId: string): Promise<OportunidadeRow[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb
    .from("freela_oportunidades").select(SELECT)
    .eq("organization_id", orgId).eq("pego_por", userId).is("deleted_at", null)
    .order("pego_em", { ascending: false });
  if (error) { console.error("[freelayide] listMinhas", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

/** Oportunidades que o usuário publicou (criou), qualquer status. */
export async function listCriadasPorMim(orgId: string, userId: string): Promise<OportunidadeRow[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb
    .from("freela_oportunidades").select(SELECT)
    .eq("organization_id", orgId).eq("criado_por", userId).is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) { console.error("[freelayide] listCriadasPorMim", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
}

export async function getMetaAtual(orgId: string): Promise<MetaRow | null> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const mesIso = inicioDoMes().slice(0, 10);
  const { data } = await sb.from("freela_metas").select("id, mes, descricao, tipo_alvo, alvo, bonus_descricao")
    .eq("organization_id", orgId).eq("mes", mesIso).maybeSingle();
  return (data as MetaRow | null) ?? null;
}

/** Ranking do mês corrente: pontos por pessoa, oportunidades PEGAS no mês. */
export async function getRanking(orgId: string): Promise<RankingEntry[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await sb.from("freela_oportunidades")
    .select("pego_por, status, negociacao_em, fechada_em, valor_comissao, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)")
    .eq("organization_id", orgId).is("deleted_at", null)
    .not("pego_por", "is", null).gte("pego_em", inicioDoMes());
  const mapa = new Map<string, RankingEntry>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const uid = r.pego_por as string;
    const nome = ((r.responsavel as { nome?: string } | null) ?? null)?.nome ?? "—";
    const status = r.status as StatusOp;
    const valor = Number(r.valor_comissao ?? 0);
    const pts = calcularPontos({ status, negociacao_em: (r.negociacao_em as string | null) ?? null, fechada_em: (r.fechada_em as string | null) ?? null, valor_comissao: valor });
    const cur = mapa.get(uid) ?? { user_id: uid, nome, pontos: 0, fechamentos: 0, comissao: 0 };
    cur.pontos += pts;
    if (status === "fechada") { cur.fechamentos += 1; cur.comissao += valor; }
    mapa.set(uid, cur);
  }
  return [...mapa.values()].sort((a, b) => b.pontos - a.pontos);
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function chaveMes(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return `${MESES_PT[mes - 1] ?? "?"} ${ano}`;
}

/**
 * Histórico do ranking em uma única query: agrupa todas as oportunidades já
 * pegas (pego_em não nulo) por mês (retrovisor) e no acumulado geral. O mês
 * corrente é sempre incluído, mesmo sem ninguém no ranking ainda.
 */
export async function getHistorico(orgId: string): Promise<FreelaHistorico> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb.from("freela_oportunidades")
    .select("pego_por, titulo, cliente_nome, status, negociacao_em, fechada_em, valor_comissao, pego_em, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)")
    .eq("organization_id", orgId).is("deleted_at", null)
    .not("pego_por", "is", null).not("pego_em", "is", null);
  if (error) { console.error("[freelayide] getHistorico", error.message); return { meses: [], geral: [] }; }

  const porMes = new Map<string, Map<string, RankingEntry>>();
  const geral = new Map<string, RankingGeralEntry>();

  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const uid = r.pego_por as string;
    const nome = ((r.responsavel as { nome?: string } | null) ?? null)?.nome ?? "—";
    const status = r.status as StatusOp;
    const valor = Number(r.valor_comissao ?? 0);
    const negociacao_em = (r.negociacao_em as string | null) ?? null;
    const fechada_em = (r.fechada_em as string | null) ?? null;
    const pego_em = r.pego_em as string;
    const pts = calcularPontos({ status, negociacao_em, fechada_em, valor_comissao: valor });
    const fechou = status === "fechada";
    const chave = chaveMes(pego_em);
    const item: RankingItem = {
      titulo: r.titulo as string,
      status,
      cliente_nome: (r.cliente_nome as string | null) ?? null,
      valor_comissao: valor,
      pego_em,
    };

    if (!porMes.has(chave)) porMes.set(chave, new Map());
    const mMap = porMes.get(chave)!;
    const cur = mMap.get(uid) ?? { user_id: uid, nome, pontos: 0, fechamentos: 0, comissao: 0, valorPego: 0, itens: [] };
    cur.pontos += pts;
    cur.valorPego! += valor;
    if (fechou) { cur.fechamentos += 1; cur.comissao += valor; }
    cur.itens!.push(item);
    mMap.set(uid, cur);

    const g = geral.get(uid) ?? { user_id: uid, nome, pontos: 0, fechamentos: 0, comissao: 0, valorPego: 0, pegas: 0, itens: [] };
    g.pontos += pts;
    g.pegas += 1;
    g.valorPego! += valor;
    if (fechou) { g.fechamentos += 1; g.comissao += valor; }
    g.itens!.push(item);
    geral.set(uid, g);
  }

  const chaveAtual = chaveMes(new Date().toISOString());
  if (!porMes.has(chaveAtual)) porMes.set(chaveAtual, new Map());

  const ordenaItens = <T extends RankingEntry>(e: T): T => { e.itens?.sort((a, b) => b.pego_em.localeCompare(a.pego_em)); return e; };

  const meses: MesRanking[] = [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // mais recente primeiro
    .map(([chave, m]) => ({
      chave,
      label: labelMes(chave),
      ranking: [...m.values()].map(ordenaItens).sort((a, b) => b.pontos - a.pontos),
    }));

  const geralArr = [...geral.values()].map(ordenaItens).sort((a, b) => b.pegas - a.pegas || b.pontos - a.pontos);

  return { meses, geral: geralArr };
}

export async function getStats(orgId: string, userId: string): Promise<FreelaStats> {
  const [todas, ranking] = await Promise.all([listOportunidades(orgId), getRanking(orgId)]);
  const disponiveis = todas.filter((o) => o.status === "disponivel");
  const idx = ranking.findIndex((r) => r.user_id === userId);
  const eu = idx >= 0 ? ranking[idx] : null;
  return {
    disponiveis: disponiveis.length,
    comissaoEmJogo: disponiveis.reduce((s, o) => s + o.valor_comissao, 0),
    ganhoNoMes: eu?.comissao ?? 0,
    meusPontos: eu?.pontos ?? 0,
    meuRank: idx >= 0 ? idx + 1 : null,
    totalNoRanking: ranking.length,
  };
}

/**
 * Pagamento por colaborador por mês: soma o valor de tudo que a pessoa pegou (por
 * pego_em), EXCETO canceladas (status = perdida), pra a gestão saber quanto pagar.
 */
export async function getPagamentosPorMes(orgId: string): Promise<MesPagamentos[]> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb.from("freela_oportunidades")
    .select("pego_por, titulo, cliente_nome, valor_comissao, pego_em, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)")
    .eq("organization_id", orgId).is("deleted_at", null)
    .not("pego_por", "is", null).not("pego_em", "is", null)
    .neq("status", "perdida");
  if (error) { console.error("[freelayide] getPagamentosPorMes", error.message); return []; }
  const rows: PagamentoInput[] = (data ?? []).map((r: Record<string, unknown>) => ({
    pego_por: r.pego_por as string,
    nome: ((r.responsavel as { nome?: string } | null) ?? null)?.nome ?? "—",
    titulo: (r.titulo as string | null) ?? "Freela",
    cliente_nome: (r.cliente_nome as string | null) ?? null,
    valor_comissao: Number(r.valor_comissao ?? 0),
    pego_em: r.pego_em as string,
  }));
  return agregarPagamentos(rows);
}

/**
 * Totais acumulados do colaborador pra derivar conquistas.
 * Sem filtro de org de propósito: um profile pertence a uma única organização e só
 * pega freelas da própria org, então `pego_por = userId` já é naturalmente escopado.
 */
export async function getConquistaStats(userId: string): Promise<ConquistaStats> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb.from("freela_oportunidades")
    .select("status, valor_comissao")
    .eq("pego_por", userId).is("deleted_at", null);
  if (error) { console.error("[freelayide] getConquistaStats", error.message); return { pegas: 0, fechamentos: 0, pequenasFechadas: 0, valorFechado: 0 }; }
  let pegas = 0, fechamentos = 0, pequenasFechadas = 0, valorFechado = 0;
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    pegas += 1;
    if (r.status === "fechada") {
      const valor = Number(r.valor_comissao ?? 0);
      fechamentos += 1;
      valorFechado += valor;
      if (valor <= 100) pequenasFechadas += 1;
    }
  }
  return { pegas, fechamentos, pequenasFechadas, valorFechado };
}

/** Conquistas já desbloqueadas pelo usuário: mapa conquista_key -> unlocked_at (ISO). */
export async function getConquistasDesbloqueadas(userId: string): Promise<Record<string, string>> {
  const sb = createServiceRoleClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data, error } = await sb.from("freela_conquistas")
    .select("conquista_key, unlocked_at").eq("user_id", userId);
  if (error) { console.error("[freelayide] getConquistasDesbloqueadas", error.message); return {}; }
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map[r.conquista_key as string] = r.unlocked_at as string;
  }
  return map;
}
