// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";

export const PROSPECTS_CACHE_TAG = "prospects";
/** Tag pra invalidar quando metas/comissão do profile mudam. Cache de
 * `getMetasComercial` é taggeado com PROSPECTS (leads) + METAS (profile). */
export const METAS_COMERCIAL_CACHE_TAG = "metas-comercial";

export type ProspectStatus = "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo" | "perdido";

export interface ProspectsFilter {
  comercialId?: string;          // se não passado, retorna todos (Sócio/ADM)
  status?: ProspectStatus[];     // multi-select
  valorMin?: number;
  valorMax?: number;
  ultimoContatoApos?: string;    // 'YYYY-MM-DD'
}

export interface ProspectListRow {
  id: string;
  nome_prospect: string;
  site: string | null;
  contato_principal: string | null;
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
  valor_proposto: number;
  comercial_id: string;
  motivo_perdido: string | null;
  data_fechamento: string | null;
  prioridade: "alta" | "media" | "baixa";
  created_at: string;
  comercial: { nome: string } | null;
  ultimo_attempt_at: string | null;
}

/**
 * Implementação interna — service-role pra rodar dentro de unstable_cache.
 * Access control fica no caller (page passa comercialId quando role=comercial).
 * Filtros aplicados direto no SQL (eq/gte/lte/or) ao invés de em memória.
 */
async function _getProspectsListImpl(filter: ProspectsFilter): Promise<ProspectListRow[]> {
  const supabase = createServiceRoleClient();

  let query = supabase
    .from("leads")
    .select("id, nome_prospect, site, contato_principal, stage, valor_proposto, comercial_id, motivo_perdido, data_fechamento, prioridade, created_at, comercial:profiles!leads_comercial_id_fkey(nome)")
    .is("deleted_at", null);

  if (filter.comercialId) {
    query = query.eq("comercial_id", filter.comercialId);
  }

  // Filtro de status (com 'perdido' como pseudo-status — coluna motivo_perdido NOT NULL)
  if (filter.status && filter.status.length > 0) {
    const wantsPerdido = filter.status.includes("perdido");
    const realStatuses = filter.status.filter((s) => s !== "perdido");

    if (wantsPerdido && realStatuses.length > 0) {
      // perdido OR (stage in [...] AND motivo_perdido IS NULL)
      query = query.or(
        `motivo_perdido.not.is.null,and(stage.in.(${realStatuses.join(",")}),motivo_perdido.is.null)`,
      );
    } else if (wantsPerdido) {
      query = query.not("motivo_perdido", "is", null);
    } else {
      query = query.in("stage", realStatuses).is("motivo_perdido", null);
    }
  }

  if (filter.valorMin !== undefined) {
    query = query.gte("valor_proposto", filter.valorMin);
  }
  if (filter.valorMax !== undefined) {
    query = query.lte("valor_proposto", filter.valorMax);
  }

  // ultimoContatoApos: feature deferida (sem query do último attempt agora)

  const { data } = await query;
  return (data ?? []) as unknown as ProspectListRow[];
}

/**
 * Versão cacheada (60s) com tag "prospects". Mutations em leads/prospects
 * devem chamar revalidateTag("prospects") pra invalidar imediatamente.
 */
export async function getProspectsList(filter: ProspectsFilter = {}): Promise<ProspectListRow[]> {
  const cached = unstable_cache(
    async (filterJson: string) => _getProspectsListImpl(JSON.parse(filterJson) as ProspectsFilter),
    ["prospeccao-list"],
    { revalidate: 60, tags: [PROSPECTS_CACHE_TAG] },
  );
  // Normaliza ordem do array de status pra cache key estável
  const normalized: ProspectsFilter = {
    ...filter,
    status: filter.status ? [...filter.status].sort() : undefined,
  };
  return cached(JSON.stringify(normalized));
}

export interface ProspectDetail {
  id: string;
  nome_prospect: string;
  site: string | null;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
  valor_proposto: number;
  comercial_id: string;
  motivo_perdido: string | null;
  data_fechamento: string | null;
  data_prospeccao_agendada: string | null;
  data_reuniao_marco_zero: string | null;
  duracao_meses: number | null;
  servico_proposto: string | null;
  prioridade: "alta" | "media" | "baixa";
  info_briefing: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  comercial: { nome: string; email: string } | null;
}

export interface LeadAgendavel {
  id: string;
  nome_prospect: string;
  stage: "prospeccao" | "comercial" | "contrato" | "marco_zero" | "ativo";
}

/**
 * Lista de leads disponíveis pra agendar reunião:
 * exclui quem já fechou (stage="ativo") ou foi marcado perdido.
 * Filtra por comercial quando passado.
 */
export async function getLeadsAgendaveis(comercialId?: string): Promise<LeadAgendavel[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, nome_prospect, stage, motivo_perdido")
    .neq("stage", "ativo")
    .order("nome_prospect");
  if (comercialId) query = query.eq("comercial_id", comercialId);
  const { data } = await query;
  const rows = (data ?? []) as Array<LeadAgendavel & { motivo_perdido: string | null }>;
  return rows
    .filter((r) => !r.motivo_perdido)
    .map(({ id, nome_prospect, stage }) => ({ id, nome_prospect, stage }));
}

async function _getProspectDetailImpl(leadId: string): Promise<ProspectDetail | null> {
  // Service-role pra rodar dentro de unstable_cache. Acesso por usuário
  // (comercial só vê os próprios) é validado no page server-side antes de
  // renderizar.
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, site, contato_principal, email, telefone, stage, valor_proposto, comercial_id, motivo_perdido, data_fechamento, data_prospeccao_agendada, data_reuniao_marco_zero, duracao_meses, servico_proposto, prioridade, info_briefing, client_id, created_at, updated_at, comercial:profiles!leads_comercial_id_fkey(nome, email)")
    .eq("id", leadId)
    .single();
  return (data as unknown as ProspectDetail | null) ?? null;
}

/** Cached 60s + tag PROSPECTS — invalidado por mutations em leads. */
export async function getProspectDetail(leadId: string): Promise<ProspectDetail | null> {
  const cached = unstable_cache(
    async (id: string) => _getProspectDetailImpl(id),
    ["prospeccao-detail"],
    { revalidate: 60, tags: [PROSPECTS_CACHE_TAG] },
  );
  return cached(leadId);
}

export interface LeadAttemptRow {
  id: string;
  lead_id: string;
  canal: "whatsapp" | "email" | "ligacao" | "presencial" | "outro";
  resultado: "sem_resposta" | "agendou" | "recusou" | "pediu_proposta" | "outro";
  observacao: string | null;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  created_at: string;
  autor_id: string;
  autor: { nome: string } | null;
}

export async function getLeadAttempts(leadId: string): Promise<LeadAttemptRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_attempts")
    .select("id, lead_id, canal, resultado, observacao, proximo_passo, data_proximo_passo, created_at, autor_id, autor:profiles!lead_attempts_autor_id_fkey(nome)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as LeadAttemptRow[];
}

export interface HistoricoFechamento {
  leadId: string;
  clienteId: string | null;
  clienteNome: string;
  valorMensal: number;
  dataFechamento: string;
  comissaoRecebida: number;
}

export async function getHistoricoFechamentos(
  comercialId: string,
  monthsBack: number = 12,
  now: Date = new Date(),
): Promise<HistoricoFechamento[]> {
  const supabase = await createClient();
  const cutoff = new Date(now.getTime() - monthsBack * 31 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: leadsData } = await supabase
    .from("leads")
    .select("id, client_id, data_fechamento, cliente:clients(id, nome, valor_mensal)")
    .eq("comercial_id", comercialId)
    .eq("stage", "ativo")
    .gte("data_fechamento", cutoff);

  const leads = (leadsData ?? []) as unknown as Array<{
    id: string;
    client_id: string | null;
    data_fechamento: string | null;
    cliente: { id: string; nome: string; valor_mensal: number } | null;
  }>;

  // Buscar todos os snapshots desse user pros meses cobertos
  const monthsSet = new Set<string>();
  for (const l of leads) {
    if (l.data_fechamento) monthsSet.add(l.data_fechamento.slice(0, 7));
  }
  const monthsList = [...monthsSet];

  let snapshotByMes = new Map<string, number>();
  if (monthsList.length > 0) {
    const { data: snapshotsData } = await supabase
      .from("commission_snapshots")
      .select("user_id, mes_referencia, valor_total")
      .eq("user_id", comercialId)
      .in("mes_referencia", monthsList);
    snapshotByMes = new Map(
      ((snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>).map(
        (s) => [s.mes_referencia, Number(s.valor_total)],
      ),
    );
  }

  const result: HistoricoFechamento[] = [];
  for (const l of leads) {
    if (!l.data_fechamento || !l.cliente) continue;
    const mes = l.data_fechamento.slice(0, 7);
    result.push({
      leadId: l.id,
      clienteId: l.client_id,
      clienteNome: l.cliente.nome,
      valorMensal: Number(l.cliente.valor_mensal),
      dataFechamento: l.data_fechamento,
      comissaoRecebida: snapshotByMes.get(mes) ?? 0,
    });
  }

  result.sort((a, b) => b.dataFechamento.localeCompare(a.dataFechamento));
  return result;
}

const FALLBACK_META_PROSPECTS = 20;
const FALLBACK_META_FECHAMENTOS = 3;
const FALLBACK_META_MULTIPLIER_RECEITA = 3;

export interface MetaItem {
  meta: number;
  realizado: number;
  pctMeta: number;
  status: "abaixo" | "no-caminho" | "perto" | "atingido";
  configurada: boolean;
}

export interface MetasComercialData {
  prospects: MetaItem;
  fechamentos: MetaItem;
  receita: MetaItem;
}

function calcStatus(pct: number): MetaItem["status"] {
  if (pct >= 100) return "atingido";
  if (pct >= 80) return "perto";
  if (pct >= 30) return "no-caminho";
  return "abaixo";
}

function buildMetaItem(meta: number, realizado: number, configurada: boolean): MetaItem {
  const pctMeta = meta > 0 ? (realizado / meta) * 100 : 0;
  return { meta, realizado, pctMeta, status: calcStatus(pctMeta), configurada };
}

/**
 * Cacheado 60s. Tags: prospects (invalida quando leads mudam) + metas-comercial
 * (invalida quando profile.fixo_mensal/comissao_percent/meta_* mudam).
 *
 * Service-role: SELECT em profiles e leads é permissivo via "authenticated using (true)".
 * Filtra por userId/comercial_id no SQL — segurança preservada.
 *
 * Cache key: monthRef vai junto pro key não confundir mês corrente com
 * histórico (a função é chamada com `now` opcional pra cálculo histórico).
 */
export async function getMetasComercial(
  userId: string,
  now: Date = new Date(),
): Promise<MetasComercialData> {
  const monthRef = getCurrentMonthYM(now);
  const cached = unstable_cache(
    async (uid: string, mes: string) => _getMetasComercialImpl(uid, mes),
    ["prospeccao-metas-comercial-v1"],
    { revalidate: 60, tags: [PROSPECTS_CACHE_TAG, METAS_COMERCIAL_CACHE_TAG] },
  );
  return cached(userId, monthRef);
}

async function _getMetasComercialImpl(
  userId: string,
  monthRef: string,
): Promise<MetasComercialData> {
  const supabase = createServiceRoleClient();
  const inicioMes = `${monthRef}-01`;
  const [yearStr, monthStr] = monthRef.split("-");
  const fimMes = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0))
    .toISOString()
    .slice(0, 10);

  // Profile e leadsMes são independentes — paralelizar pra economizar 1 round-trip
  // (essa função roda no dashboard de cada comercial em todo refresh).
  const [{ data: profileData }, { data: leadsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("fixo_mensal, comissao_percent, meta_prospects_mes, meta_fechamentos_mes, meta_receita_mes")
      .eq("id", userId)
      .single(),
    supabase
      .from("leads")
      .select("id, stage, valor_proposto, data_fechamento, created_at")
      .eq("comercial_id", userId)
      .gte("created_at", inicioMes)
      .lte("created_at", fimMes + "T23:59:59"),
  ]);

  const profile = (profileData as {
    fixo_mensal: number;
    comissao_percent: number;
    meta_prospects_mes: number | null;
    meta_fechamentos_mes: number | null;
    meta_receita_mes: number | null;
  } | null) ?? {
    fixo_mensal: 0,
    comissao_percent: 0,
    meta_prospects_mes: null,
    meta_fechamentos_mes: null,
    meta_receita_mes: null,
  };

  const leadsMes = (leadsData ?? []) as Array<{ id: string; stage: string; valor_proposto: number; data_fechamento: string | null; created_at: string }>;

  // Realizado: prospects abordados no mês = leads CRIADOS no mês
  const realizadoProspects = leadsMes.length;

  // Realizado: fechamentos no mês
  const fechadosNoMes = leadsMes.filter(
    (l) => l.stage === "ativo" && l.data_fechamento && l.data_fechamento >= inicioMes && l.data_fechamento <= fimMes,
  );
  const realizadoFechamentos = fechadosNoMes.length;
  const realizadoReceita = fechadosNoMes.reduce((a, l) => a + Number(l.valor_proposto), 0);

  // Metas
  const fixo = Number(profile.fixo_mensal);
  const pct = Number(profile.comissao_percent);

  const metaProspects = profile.meta_prospects_mes ?? FALLBACK_META_PROSPECTS;
  const metaFechamentos = profile.meta_fechamentos_mes ?? FALLBACK_META_FECHAMENTOS;
  const metaReceitaAuto = pct > 0 ? (FALLBACK_META_MULTIPLIER_RECEITA * fixo) / (pct / 100) : 0;
  const metaReceita = profile.meta_receita_mes !== null ? Number(profile.meta_receita_mes) : metaReceitaAuto;

  return {
    prospects: buildMetaItem(metaProspects, realizadoProspects, profile.meta_prospects_mes !== null),
    fechamentos: buildMetaItem(metaFechamentos, realizadoFechamentos, profile.meta_fechamentos_mes !== null),
    receita: buildMetaItem(metaReceita, realizadoReceita, profile.meta_receita_mes !== null),
  };
}
