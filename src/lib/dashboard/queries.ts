// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM, getPreviousMonthYM, getTodayDate } from "@/lib/datetime/timezone";
import { isInMonth, monthRange, lastDayOfMonth } from "./date-utils";

interface ClientRow {
  id: string;
  valor_mensal: number;
  data_entrada: string;
  data_churn: string | null;
  status: string;
  tipo_relacao?: string | null;
  modalidade?: string | null;
  assessor_id?: string | null;
  coordenador_id?: string | null;
}

export interface KpiData {
  carteiraAtiva: { valor: number; deltaValor: number };
  clientesAtivos: { quantidade: number; deltaQuantidade: number };
  /** Churn = só clientes mensais que sairam. Pontuais encerrados não contam. */
  churnMes: { quantidade: number; valorPerdido: number };
  custoComissaoPct: { pct: number };
  /** Pontuais: ativos hoje (vigentes) + concluídos no mês corrente + soma do valor dos ativos. */
  servicosPontuais: { ativos: number; concluidosMes: number; valorTotal: number };
  /** Ticket médio = carteira ativa / nº de mensais ativos (comum). */
  ticketMedio: { valor: number };
  /**
   * LTV (Lifetime Value) = ticket médio / churn rate mensal.
   * `valor: null` quando churn do mês = 0 (não dá pra calcular sem churn).
   * `churnRatePct`: taxa de churn do mês em %, exposta pro tooltip do card.
   */
  ltv: { valor: number | null; churnRatePct: number };
}

export interface ClientFilter {
  assessorId?: string;
  coordenadorId?: string;
  /** Multi-tenant: quando passado, restringe à unidade. null/undefined = consolidado (master).
   *  Page deve passar via getEffectiveUnitId(). */
  unitId?: string | null;
}

function buildClientFilterQuery<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filter?: ClientFilter,
): T {
  let q = query;
  if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
  return q;
}

function isActiveOn(c: ClientRow, dateIso: string): boolean {
  // Cliente está ativo no dia X se entrou até X e (não churnou OU churnou depois de X)
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

// ─── getKpis ────────────────────────────────────────────────────────────────

export async function _getKpisImpl(filter?: ClientFilter): Promise<KpiData> {
  const supabase = createServiceRoleClient();
  const monthRef = getCurrentMonthYM();
  const todayIso = getTodayDate();

  const prevMonthRef = getPreviousMonthYM();
  const prevMonthLastDay = lastDayOfMonth(prevMonthRef);

  // Não filtra por status='ativo' no SQL - precisamos dos churnados pra contar
  // o churn do mês e o delta vs mês anterior. Onboarding é excluído porque
  // ainda não entrou no ciclo de vida da carteira.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // Mete o snapshots no Promise.all original - não depende de nenhum dos outros.
  // Antes era um await sequencial após esse bloco; agora poupa 1 round-trip.
  const [
    { data: clientsData },
    { data: ajustesAtuais },
    { data: ajustesAnteriores },
    { data: snapshotsData },
  ] = await Promise.all([
    buildClientFilterQuery(
      supabase
        .from("clients")
        .select("id, valor_mensal, data_entrada, data_churn, status, tipo_relacao, modalidade, assessor_id, coordenador_id")
        .is("deleted_at", null)
        .neq("status", "em_onboarding"),
      filter,
    ),
    sb
      .from("client_monthly_adjustments")
      .select("client_id, tipo, valor_desconto")
      .eq("mes_referencia", monthRef),
    sb
      .from("client_monthly_adjustments")
      .select("client_id, tipo, valor_desconto")
      .eq("mes_referencia", prevMonthRef),
    supabase
      .from("commission_snapshots")
      .select("mes_referencia, valor_total")
      .order("mes_referencia", { ascending: false })
      .limit(50),
  ]);
  // Cast via unknown porque os types gerados do Supabase ainda não conhecem
  // a coluna 'modalidade' (gerada após `npm run db:types` pós-migration).
  const allClients = (clientsData ?? []) as unknown as ClientRow[];

  const ajusteAtualByClient = new Map(
    ((ajustesAtuais ?? []) as Array<{ client_id: string; tipo: string; valor_desconto: number | null }>).map(
      (a) => [a.client_id, a],
    ),
  );
  const ajusteAnteriorByClient = new Map(
    ((ajustesAnteriores ?? []) as Array<{ client_id: string; tipo: string; valor_desconto: number | null }>).map(
      (a) => [a.client_id, a],
    ),
  );

  const valorEfetivo = (
    c: ClientRow,
    ajusteMap: Map<string, { tipo: string; valor_desconto: number | null }>,
  ): number => {
    if (c.tipo_relacao && c.tipo_relacao !== "comum") return 0;
    const a = ajusteMap.get(c.id);
    const valor = Number(c.valor_mensal);
    if (!a) return valor;
    if (a.tipo === "gratuidade_total") return 0;
    if (a.tipo === "desconto_parcial") return Math.max(0, valor - Number(a.valor_desconto ?? 0));
    return valor;
  };

  const ativosHoje = allClients.filter((c) => isActiveOn(c, todayIso));
  const ativosFimMesAnterior = allClients.filter((c) => isActiveOn(c, prevMonthLastDay));

  // KPI financeiro: apenas clientes 'comum' (parceria/permuta excluídos - sem $ circulando)
  const ativosHojeComum = ativosHoje.filter((c) => !c.tipo_relacao || c.tipo_relacao === "comum");
  const ativosFimMesAnteriorComum = ativosFimMesAnterior.filter((c) => !c.tipo_relacao || c.tipo_relacao === "comum");

  // Carteira ativa = soma dos valores EFETIVOS (considera bônus/desconto do mês).
  const carteiraAtivaValor = ativosHojeComum.reduce((acc, c) => acc + valorEfetivo(c, ajusteAtualByClient), 0);
  const carteiraMesAnteriorValor = ativosFimMesAnteriorComum.reduce(
    (acc, c) => acc + valorEfetivo(c, ajusteAnteriorByClient),
    0,
  );

  // Churn = só clientes MENSAIS que sairam no mês. Pontuais encerrados são
  // "concluídos" (faziam serviço único) e contam separadamente.
  const ehMensal = (c: ClientRow) => !c.modalidade || c.modalidade === "mensal";
  const ehPontual = (c: ClientRow) => c.modalidade === "pontual";

  const churnsDoMes = allClients.filter((c) => isInMonth(c.data_churn, monthRef) && ehMensal(c));
  // valorChurnado: apenas comum
  const valorChurnado = churnsDoMes
    .filter((c) => !c.tipo_relacao || c.tipo_relacao === "comum")
    .reduce((acc, c) => acc + Number(c.valor_mensal), 0);

  // Serviços pontuais - contagem própria, sem entrar no churn.
  const pontuaisAtivosArr = allClients.filter((c) => ehPontual(c) && c.status === "ativo");
  const pontuaisAtivos = pontuaisAtivosArr.length;
  const pontuaisValorTotal = pontuaisAtivosArr.reduce((acc, c) => acc + Number(c.valor_mensal ?? 0), 0);
  const pontuaisConcluidosMes = allClients.filter(
    (c) => ehPontual(c) && isInMonth(c.data_churn, monthRef),
  ).length;

  // Custo de comissão: prefere snapshot oficial (mês fechado) - se não tem,
  // calcula live usando o preview de comissões (mesma fonte que a página
  // /comissoes mostra como "Em curso"). snapshotsData já veio do Promise.all acima.
  const snapshots = (snapshotsData ?? []) as Array<{ mes_referencia: string; valor_total: number }>;
  const ultimoMes = snapshots[0]?.mes_referencia;
  let totalComissao = ultimoMes
    ? snapshots.filter((s) => s.mes_referencia === ultimoMes).reduce((a, s) => a + Number(s.valor_total), 0)
    : 0;

  // Sem snapshot e sem filtro (dashboard sócio): calcula preview live.
  // Pra assessor/coord, KPI não é relevante - mantém 0.
  if (totalComissao === 0 && !filter?.assessorId && !filter?.coordenadorId) {
    const { previewAllForMonth } = await import("@/lib/comissoes/preview");
    const previewRows = await previewAllForMonth(monthRef);
    totalComissao = previewRows.reduce((acc, r) => acc + Number(r.valor_total), 0);
  }

  const pctComissao = carteiraAtivaValor > 0 ? (totalComissao / carteiraAtivaValor) * 100 : 0;

  // Ticket médio = carteira ativa (R$) / nº de mensais comum ativos.
  // Excluímos pontuais (modalidade=pontual) do denominador - eles têm
  // valor_mensal que representa o projeto único, distorceria a média.
  const mensaisAtivosComum = ativosHojeComum.filter((c) => !c.modalidade || c.modalidade === "mensal");
  const ticketMedioValor =
    mensaisAtivosComum.length > 0 ? carteiraAtivaValor / mensaisAtivosComum.length : 0;

  // LTV (Lifetime Value) = ticket médio / churn rate mensal.
  // Numerador do churn rate: churns mensais do mês (já filtrado por ehMensal).
  // Denominador: mensais comum ATIVOS no fim do mês anterior (base que
  // entrou no mês corrente). Pontuais ficam fora pra não diluir a base
  // (não dão churn, dão "conclusão").
  const mensaisFimMesAnteriorComum = ativosFimMesAnteriorComum.filter(
    (c) => !c.modalidade || c.modalidade === "mensal",
  );
  const churnsMensaisComumDoMes = churnsDoMes.filter(
    (c) => !c.tipo_relacao || c.tipo_relacao === "comum",
  );
  const churnRateMensal =
    mensaisFimMesAnteriorComum.length > 0
      ? churnsMensaisComumDoMes.length / mensaisFimMesAnteriorComum.length
      : 0;
  const ltvValor = churnRateMensal > 0 ? ticketMedioValor / churnRateMensal : null;

  return {
    carteiraAtiva: { valor: carteiraAtivaValor, deltaValor: carteiraAtivaValor - carteiraMesAnteriorValor },
    clientesAtivos: { quantidade: ativosHoje.length, deltaQuantidade: ativosHoje.length - ativosFimMesAnterior.length },
    churnMes: { quantidade: churnsDoMes.length, valorPerdido: valorChurnado },
    custoComissaoPct: { pct: pctComissao },
    servicosPontuais: { ativos: pontuaisAtivos, concluidosMes: pontuaisConcluidosMes, valorTotal: pontuaisValorTotal },
    ticketMedio: { valor: ticketMedioValor },
    ltv: { valor: ltvValor, churnRatePct: churnRateMensal * 100 },
  };
}

export async function getKpis(filter?: ClientFilter): Promise<KpiData> {
  const cached = unstable_cache(
    async (filterJson: string) => {
      const f = filterJson !== "null" ? (JSON.parse(filterJson) as ClientFilter) : undefined;
      return _getKpisImpl(f);
    },
    // v3: distingue mensal vs pontual no churn + KPI de serviços pontuais
    // v4: shape mudou (servicosPontuais ganhou valorTotal)
    // v5: shape mudou (adicionado ticketMedio + ltv)
    // v6: filter ganhou unitId (multi-tenant)
    ["dashboard-kpis-v6"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify(filter ?? null));
}

// ─── getCarteiraTimeline ─────────────────────────────────────────────────────

export interface TimelinePoint {
  mes: string;          // 'YYYY-MM'
  valorTotal: number;
}

export async function _getCarteiraTimelineImpl(
  months: number,
  filter?: ClientFilter,
): Promise<TimelinePoint[]> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const meses = monthRange(months, now);

  let clientsQuery = supabase
    .from("clients")
    .select("id, valor_mensal, data_entrada, data_churn, tipo_relacao, assessor_id, coordenador_id")
    .is("deleted_at", null)
    .eq("tipo_relacao", "comum");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{
    id: string;
    valor_mensal: number;
    data_entrada: string;
    data_churn: string | null;
    tipo_relacao?: string | null;
    assessor_id?: string | null;
    coordenador_id?: string | null;
  }>;

  return meses.map((mes) => {
    const fimDoMes = lastDayOfMonth(mes);
    const ativos = clients.filter((c) => {
      if (c.data_entrada > fimDoMes) return false;
      if (c.data_churn && c.data_churn <= fimDoMes) return false;
      return true;
    });
    const valorTotal = ativos.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return { mes, valorTotal };
  });
}

export async function getCarteiraTimeline(months = 12, filter?: ClientFilter): Promise<TimelinePoint[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { months: m, filter: f } = JSON.parse(paramsJson) as { months: number; filter: ClientFilter | null };
      return _getCarteiraTimelineImpl(m, f ?? undefined);
    },
    // v2: filter ganhou unitId (multi-tenant)
    ["dashboard-carteira-timeline-v2"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ months, filter: filter ?? null }));
}

// ─── getEntradaChurn ─────────────────────────────────────────────────────────

export interface EntradaChurnClient {
  id: string;
  nome: string;
}

export interface EntradaChurnPoint {
  mes: string;
  /** Mensais (assinaturas) que entraram no mês. */
  entradas: number;
  /** Mensais (assinaturas) que deram churn no mês. */
  churns: number;
  /** Serviços pontuais (avulsos) que começaram no mês - não são churn quando terminam. */
  avulsos: number;
  /** Clientes que entraram nesse mês (mensais) - lista pra drill-down. */
  entradas_clientes: EntradaChurnClient[];
  /** Clientes que deram churn nesse mês (mensais). */
  churns_clientes: EntradaChurnClient[];
  /** Pontuais que começaram nesse mês. */
  avulsos_clientes: EntradaChurnClient[];
}

export async function _getEntradaChurnImpl(
  months: number,
  filter?: ClientFilter,
): Promise<EntradaChurnPoint[]> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const meses = monthRange(months, now);

  // Filtros SQL:
  // - deleted_at IS NULL → ignora lixeira
  // - tipo_relacao = 'comum' → ignora parceria/permuta (não envolvem $)
  // - status != 'em_onboarding' → consistência com KPIs (cliente em onboarding
  //   ainda não entrou na carteira - antes essa query contava como entrada)
  //
  // `modalidade` é puxada pra separar mensal (entrada/churn) de pontual
  // (avulso). Avulso aparece quando começa, não quando termina (terminar
  // pontual não é "churn" - é conclusão de serviço único).
  //
  // Cast `as any`: types do Supabase ainda não conhecem a coluna `modalidade`
  // (gerada após `npm run db:types` pós-migration). Mesma técnica usada em
  // _getKpisImpl acima.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let clientsQuery = sb
    .from("clients")
    .select("id, nome, data_entrada, data_churn, tipo_relacao, modalidade, status, assessor_id, coordenador_id")
    .is("deleted_at", null)
    .eq("tipo_relacao", "comum")
    .neq("status", "em_onboarding");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  const { data: clientsData } = await clientsQuery;
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    data_entrada: string;
    data_churn: string | null;
    tipo_relacao?: string | null;
    modalidade?: string | null;
    status?: string | null;
    assessor_id?: string | null;
    coordenador_id?: string | null;
  }>;

  // Default de modalidade é "mensal" no schema - clientes antigos sem o campo
  // setado também são tratados como mensal.
  const ehMensal = (c: { modalidade?: string | null }) => !c.modalidade || c.modalidade === "mensal";
  const ehPontual = (c: { modalidade?: string | null }) => c.modalidade === "pontual";

  return meses.map((mes) => {
    const entradas_clientes = clients
      .filter((c) => ehMensal(c) && isInMonth(c.data_entrada, mes))
      .map((c) => ({ id: c.id, nome: c.nome }));
    const churns_clientes = clients
      .filter((c) => ehMensal(c) && isInMonth(c.data_churn, mes))
      .map((c) => ({ id: c.id, nome: c.nome }));
    const avulsos_clientes = clients
      .filter((c) => ehPontual(c) && isInMonth(c.data_entrada, mes))
      .map((c) => ({ id: c.id, nome: c.nome }));
    return {
      mes,
      entradas: entradas_clientes.length,
      churns: churns_clientes.length,
      avulsos: avulsos_clientes.length,
      entradas_clientes,
      churns_clientes,
      avulsos_clientes,
    };
  });
}

export async function getEntradaChurn(months = 6, filter?: ClientFilter): Promise<EntradaChurnPoint[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { months: m, filter: f } = JSON.parse(paramsJson) as { months: number; filter: ClientFilter | null };
      return _getEntradaChurnImpl(m, f ?? undefined);
    },
    // v3: shape mudou - adicionado avulsos/avulsos_clientes (pontuais) +
    // fix bug em_onboarding contado como entrada.
    // v4: filter ganhou unitId (multi-tenant)
    ["dashboard-entrada-churn-v4"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ months, filter: filter ?? null }));
}

// ─── getCarteiraPorAssessor ──────────────────────────────────────────────────

export interface AssessorCarteira {
  assessorId: string;
  assessorNome: string;
  qtdClientes: number;
  valorTotal: number;
  pctDoTotal: number;
}

export async function _getCarteiraPorAssessorImpl(filter?: ClientFilter): Promise<AssessorCarteira[]> {
  const supabase = createServiceRoleClient();
  const monthRef = getCurrentMonthYM();

  let clientsQuery = supabase
    .from("clients")
    .select("id, valor_mensal, assessor_id, coordenador_id, tipo_relacao, assessor:profiles!clients_assessor_id_fkey(nome)")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .eq("tipo_relacao", "comum");
  clientsQuery = buildClientFilterQuery(clientsQuery as never, filter) as never;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: clientsData }, { data: ajustesData }] = await Promise.all([
    clientsQuery,
    sb
      .from("client_monthly_adjustments")
      .select("client_id, tipo, valor_desconto")
      .eq("mes_referencia", monthRef),
  ]);

  const clients = (clientsData ?? []) as unknown as Array<{
    id: string;
    valor_mensal: number;
    assessor_id: string | null;
    coordenador_id: string | null;
    assessor: { nome: string } | null;
  }>;
  const ajusteByClient = new Map(
    ((ajustesData ?? []) as Array<{ client_id: string; tipo: string; valor_desconto: number | null }>).map(
      (a) => [a.client_id, a],
    ),
  );

  const groups = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const c of clients) {
    if (!c.assessor_id || !c.assessor) continue;
    const cur = groups.get(c.assessor_id) ?? { nome: c.assessor.nome, qtd: 0, valor: 0 };
    cur.qtd += 1;
    // Valor efetivo do mês: considera bônus/desconto.
    const a = ajusteByClient.get(c.id);
    const valorBase = Number(c.valor_mensal);
    const valorEfetivo =
      !a ? valorBase :
      a.tipo === "gratuidade_total" ? 0 :
      a.tipo === "desconto_parcial" ? Math.max(0, valorBase - Number(a.valor_desconto ?? 0)) :
      valorBase;
    cur.valor += valorEfetivo;
    groups.set(c.assessor_id, cur);
  }

  const total = [...groups.values()].reduce((a, g) => a + g.valor, 0);

  const list: AssessorCarteira[] = [...groups.entries()].map(([id, g]) => ({
    assessorId: id,
    assessorNome: g.nome,
    qtdClientes: g.qtd,
    valorTotal: g.valor,
    pctDoTotal: total > 0 ? (g.valor / total) * 100 : 0,
  }));

  list.sort((a, b) => b.valorTotal - a.valorTotal);
  return list;
}

export async function getCarteiraPorAssessor(filter?: ClientFilter): Promise<AssessorCarteira[]> {
  const cached = unstable_cache(
    async (filterJson: string) => {
      const f = filterJson !== "null" ? (JSON.parse(filterJson) as ClientFilter) : undefined;
      return _getCarteiraPorAssessorImpl(f);
    },
    // v2: valor por assessor agora considera ajustes mensais
    // v3: filter ganhou unitId (multi-tenant)
    ["dashboard-carteira-por-assessor-v3"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify(filter ?? null));
}

// ─── getRankingSatisfacao ────────────────────────────────────────────────────

import { currentIsoWeek } from "@/lib/satisfacao/iso-week";
import { computeWeeklyRanking, sliceTopBottom, type RankedClient } from "@/lib/satisfacao/ranking";

export type SynthesisRowWithCliente = RankedClient;

export async function _getRankingSatisfacaoImpl(filter?: ClientFilter): Promise<{
  top: RankedClient[];
  bottom: RankedClient[];
}> {
  const all = await computeWeeklyRanking(currentIsoWeek(), filter);
  return sliceTopBottom(all);
}

export async function getRankingSatisfacao(filter?: ClientFilter): Promise<{
  top: RankedClient[];
  bottom: RankedClient[];
}> {
  const cached = unstable_cache(
    async (filterJson: string) => {
      const f = filterJson !== "null" ? (JSON.parse(filterJson) as ClientFilter) : undefined;
      return _getRankingSatisfacaoImpl(f);
    },
    // v2: filter ganhou unitId (multi-tenant)
    ["dashboard-ranking-satisfacao-v2"],
    // 60s - responsivo a votos novos. Mutations de satisfação já invalidam
    // o tag 'dashboard', então em prática atualiza imediatamente após voto.
    { revalidate: 60, tags: ["dashboard"] },
  );
  return cached(JSON.stringify(filter ?? null));
}

// ─── getProximosEventos ──────────────────────────────────────────────────────

export interface EventoRow {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  sub_calendar: "agencia" | "onboarding" | "aniversarios";
}

export interface EventoFilter {
  userId?: string;
  /** Quando passado, restringe aos sub_calendars listados (ex.: ADM só vê
   * agencia/onboarding/aniversarios - não as gravações de videomakers). */
  subCalendars?: string[];
  /** Multi-tenant: client_ids da unidade ativa. Quando passado, filtra
   *  eventos com client_id apenas pra esses (eventos sem client_id passam
   *  livres - são eventos gerais da agência tipo aniversários). */
  unitClientIds?: string[] | null;
}

export async function _getProximosEventosImpl(
  days: number,
  limit: number,
  filter?: EventoFilter,
): Promise<EventoRow[]> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("calendar_events")
    .select("id, titulo, inicio, fim, sub_calendar, client_id");

  if (filter?.userId) {
    query = query.contains("participantes_ids", [filter.userId]);
  }
  if (filter?.subCalendars && filter.subCalendars.length > 0) {
    query = query.in("sub_calendar", filter.subCalendars);
  }

  const { data } = await query
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio", { ascending: true })
    .limit(limit * 2); // pega mais pra compensar filtro pós-query

  let rows = ((data ?? []) as Array<EventoRow & { client_id: string | null; sub_calendar: string }>);

  // Multi-tenant: filtro estrito.
  // - sub_calendar='aniversarios' → institucional, sempre passa
  // - resto → exige client_id na lista da unidade ativa
  //
  // Versão anterior (PR #363) deixava passar eventos com client_id=null
  // como "institucionais", mas na prática muitos eventos legacy foram
  // criados sem link explícito (só nome do cliente no título). Esses
  // estavam vazando entre unidades. Agora ficam ocultos quando filtro
  // ativo - assessor pode editar o evento pra linkar ao client_id se
  // quiser que apareça.
  if (filter?.unitClientIds !== undefined && filter?.unitClientIds !== null) {
    const allowedIds = new Set(filter.unitClientIds);
    rows = rows.filter((r) => {
      if (r.sub_calendar === "aniversarios") return true;
      if (r.client_id === null) return false;
      return allowedIds.has(r.client_id);
    });
  }

  return rows.slice(0, limit).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    inicio: r.inicio,
    fim: r.fim,
    sub_calendar: r.sub_calendar as EventoRow["sub_calendar"],
  }));
}

export async function getProximosEventos(
  days = 30,
  limit = 10,
  filter?: EventoFilter,
): Promise<EventoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { days: d, limit: l, filter: f } = JSON.parse(paramsJson) as { days: number; limit: number; filter: EventoFilter | null };
      return _getProximosEventosImpl(d, l, f ?? undefined);
    },
    // v4: filtro estrito - eventos sem client_id agora são ocultos
    // quando filtro de unidade ativo (exceto sub_calendar='aniversarios')
    ["dashboard-proximos-eventos-v4"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ days, limit, filter: filter ?? null }));
}

// ─── getMesAguardandoAprovacao ───────────────────────────────────────────────

export async function _getMesAguardandoAprovacaoImpl(): Promise<{ mes: string } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("commission_snapshots")
    .select("mes_referencia")
    .eq("status", "pending_approval")
    .order("mes_referencia", { ascending: false })
    .limit(1);

  const row = (data?.[0] as { mes_referencia?: string } | undefined);
  return row?.mes_referencia ? { mes: row.mes_referencia } : null;
}

export async function getMesAguardandoAprovacao(): Promise<{ mes: string } | null> {
  const cached = unstable_cache(
    async () => {
      return _getMesAguardandoAprovacaoImpl();
    },
    ["dashboard-mes-aguardando-aprovacao"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached();
}
