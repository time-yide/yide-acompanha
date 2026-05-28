// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calcularPontos } from "./pontos";
import type { StatusOp, TipoOp } from "./tipos";

export interface OportunidadeRow {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_nome: string | null;
  contato: string | null;
  valor_comissao: number;
  status: StatusOp;
  tipo: TipoOp;
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

export interface RankingEntry {
  user_id: string;
  nome: string;
  pontos: number;
  fechamentos: number;
  comissao: number;
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
  "id, titulo, descricao, cliente_nome, contato, valor_comissao, status, tipo, pego_por, pego_em, negociacao_em, fechada_em, created_at, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)";

function mapRow(row: Record<string, unknown>): OportunidadeRow {
  const status = row.status as StatusOp;
  const valor_comissao = Number(row.valor_comissao ?? 0);
  const base = {
    id: row.id as string,
    titulo: row.titulo as string,
    descricao: (row.descricao as string | null) ?? null,
    cliente_nome: (row.cliente_nome as string | null) ?? null,
    contato: (row.contato as string | null) ?? null,
    valor_comissao,
    status,
    tipo: (row.tipo as TipoOp) ?? "captacao",
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
