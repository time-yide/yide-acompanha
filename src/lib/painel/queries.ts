// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";
import type { StepKey, StepStatus } from "./deadlines";
import type { TipoPacote } from "./pacote-matrix";

export const PAINEL_CACHE_TAG = "painel";

type CadenciaReuniao = "semanal" | "quinzenal" | "mensal" | "trimestral";

export interface ChecklistFilter {
  assessorId?: string;
  coordenadorId?: string;
  designerId?: string;
  videomakerId?: string;
  editorId?: string;
  /** Quando preenchido, retorna clientes onde o user é videomaker_id OU editor_id. */
  audiovisualUserId?: string;
  /**
   * Multi-tenant: ids dos clientes da unidade ativa. null = sem filtro
   * (master vendo todas / migration não rodada). [] = unidade nova sem clientes.
   */
  unitClientIds?: string[] | null;
}

export interface ChecklistStepRow {
  id: string;
  step_key: StepKey;
  status: StepStatus;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

export interface ChecklistRow {
  id: string;
  client_id: string;
  client_nome: string;
  client_designer_id: string | null;
  client_videomaker_id: string | null;
  client_editor_id: string | null;
  client_drive_url: string | null;
  client_instagram_url: string | null;
  client_link_estrategia: string | null;
  client_tipo_pacote: TipoPacote;
  client_tipo_pacote_revisado: boolean;
  client_cadencia_reuniao: CadenciaReuniao | null;
  client_numero_unidades: number;
  client_valor_trafego_google: number | null;
  client_valor_trafego_meta: number | null;
  mes_referencia: string;
  pacote_post: number | null;
  quantidade_postada: number | null;
  valor_trafego_mes: number | null;
  tpg_ativo: boolean | null;
  tpm_ativo: boolean | null;
  gmn_comentarios: number;
  gmn_avaliacoes: number;
  gmn_nota_media: number | null;
  gmn_observacoes: string | null;
  gmn_otimizado: boolean;
  gravacao_count: number;
  steps: ChecklistStepRow[];
}

/**
 * Cacheado 60s + tag "painel". Server uses service-role pra rodar dentro
 * do cache; SELECT policies em clients/client_monthly_checklist/checklist_step
 * são todas permissivas (`using (true)`), então segurança é definida pelo
 * filter passado pelo caller (que aplica role-based filtering antes).
 *
 * Mutações em checklist_step / client_monthly_checklist / clients (campos
 * de atribuição) devem chamar revalidateTag(PAINEL_CACHE_TAG).
 */
export async function getMonthlyChecklists(
  mesReferencia: string,
  filter: ChecklistFilter = {},
): Promise<ChecklistRow[]> {
  const cached = unstable_cache(
    async (mes: string, filterJson: string) => {
      const f = JSON.parse(filterJson) as ChecklistFilter;
      return _getMonthlyChecklistsImpl(mes, f);
    },
    // v5: filter ganhou unitClientIds (multi-tenant)
    ["painel-monthly-checklists-v5"],
    { revalidate: 60, tags: [PAINEL_CACHE_TAG] },
  );
  return cached(mesReferencia, JSON.stringify(filter));
}

async function _getMonthlyChecklistsImpl(
  mesReferencia: string,
  filter: ChecklistFilter,
): Promise<ChecklistRow[]> {
  const supabase = createServiceRoleClient();

  // Filtro multi-tenant: se unidade não tem nenhum cliente, retorna vazio.
  if (filter.unitClientIds !== null && filter.unitClientIds !== undefined && filter.unitClientIds.length === 0) {
    return [];
  }

  // 1) Lista clientes filtrados (apenas pacotes do painel mensal)
  // Helper que monta a query dado um SELECT (pra poder fazer fallback quando
  // a coluna `link_estrategia` ainda não existe - migração não rodada).
  const buildClientsQuery = (selectStr: string) => {
    let q = supabase
      .from("clients")
      .select(selectStr)
      .eq("status", "ativo")
      .in("tipo_pacote", [
        "trafego_estrategia", "trafego", "estrategia", "audiovisual", "yide_360",
      ]);
    if (filter.assessorId) q = q.eq("assessor_id", filter.assessorId);
    if (filter.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);
    if (filter.designerId) q = q.eq("designer_id", filter.designerId);
    if (filter.videomakerId) q = q.eq("videomaker_id", filter.videomakerId);
    if (filter.editorId) q = q.eq("editor_id", filter.editorId);
    if (filter.audiovisualUserId) {
      q = q.or(
        `videomaker_id.eq.${filter.audiovisualUserId},editor_id.eq.${filter.audiovisualUserId}`,
      );
    }
    // Multi-tenant: filtra pela unidade ativa quando aplicável.
    if (filter.unitClientIds && filter.unitClientIds.length > 0) {
      q = q.in("id", filter.unitClientIds);
    }
    return q.order("nome");
  };

  const SELECT_COMPLETO = `
    id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id,
    drive_url, instagram_url, link_estrategia,
    tipo_pacote, tipo_pacote_revisado, cadencia_reuniao, numero_unidades,
    valor_trafego_google, valor_trafego_meta
  `;
  const SELECT_SEM_LINK_ESTRATEGIA = `
    id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id,
    drive_url, instagram_url,
    tipo_pacote, tipo_pacote_revisado, cadencia_reuniao, numero_unidades,
    valor_trafego_google, valor_trafego_meta
  `;

  let clientsResp = await buildClientsQuery(SELECT_COMPLETO);
  // Fallback: se PostgREST reclamar de coluna que não existe (migração ainda
  // não rodada em prod), tenta de novo sem link_estrategia. Sem isso, todo o
  // painel ficaria vazio.
  if (clientsResp.error) {
    const msg = clientsResp.error.message ?? "";
    if (msg.includes("link_estrategia") || msg.includes("schema cache")) {
      console.warn("[painel] link_estrategia indisponível no banco - usando fallback");
      clientsResp = await buildClientsQuery(SELECT_SEM_LINK_ESTRATEGIA);
    } else {
      console.error("[painel] erro ao listar clientes:", msg);
    }
  }
  const clients = ((clientsResp.data ?? []) as unknown as Array<{
    id: string;
    nome: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
    drive_url: string | null;
    instagram_url: string | null;
    link_estrategia?: string | null;
    tipo_pacote: TipoPacote;
    tipo_pacote_revisado: boolean;
    cadencia_reuniao: CadenciaReuniao | null;
    numero_unidades: number;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
  }>).map((c) => ({
    ...c,
    link_estrategia: c.link_estrategia ?? null,
  }));

  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // 2) Carrega checklists do mês
  // Mesmo padrão de fallback: se gmn_otimizado ainda não foi migrada, tenta
  // de novo sem ela.
  const buildChecklistsQuery = (selectStr: string) =>
    supabase
      .from("client_monthly_checklist")
      .select(selectStr)
      .eq("mes_referencia", mesReferencia)
      .in("client_id", clientIds);

  const SELECT_CHECKLIST_COMPLETO = `
    id, client_id, mes_referencia,
    pacote_post, quantidade_postada, valor_trafego_mes,
    tpg_ativo, tpm_ativo,
    gmn_comentarios, gmn_avaliacoes, gmn_nota_media, gmn_observacoes, gmn_otimizado
  `;
  const SELECT_CHECKLIST_SEM_OTIMIZADO = `
    id, client_id, mes_referencia,
    pacote_post, quantidade_postada, valor_trafego_mes,
    tpg_ativo, tpm_ativo,
    gmn_comentarios, gmn_avaliacoes, gmn_nota_media, gmn_observacoes
  `;

  let checklistsResp = await buildChecklistsQuery(SELECT_CHECKLIST_COMPLETO);
  if (checklistsResp.error) {
    const msg = checklistsResp.error.message ?? "";
    if (msg.includes("gmn_otimizado") || msg.includes("schema cache")) {
      console.warn("[painel] gmn_otimizado indisponível no banco - usando fallback");
      checklistsResp = await buildChecklistsQuery(SELECT_CHECKLIST_SEM_OTIMIZADO);
    } else {
      console.error("[painel] erro ao listar checklists:", msg);
    }
  }
  const checklists = ((checklistsResp.data ?? []) as unknown as Array<{
    id: string;
    client_id: string;
    mes_referencia: string;
    pacote_post: number | null;
    quantidade_postada: number | null;
    valor_trafego_mes: number | null;
    tpg_ativo: boolean | null;
    tpm_ativo: boolean | null;
    gmn_comentarios: number;
    gmn_avaliacoes: number;
    gmn_nota_media: number | null;
    gmn_observacoes: string | null;
    gmn_otimizado?: boolean;
  }>).map((cl) => ({
    ...cl,
    gmn_otimizado: cl.gmn_otimizado ?? false,
  }));

  if (checklists.length === 0) {
    return clients.map((c) => ({
      id: "",
      client_id: c.id,
      client_nome: c.nome,
      client_designer_id: c.designer_id,
      client_videomaker_id: c.videomaker_id,
      client_editor_id: c.editor_id,
      client_drive_url: c.drive_url,
      client_instagram_url: c.instagram_url,
      client_link_estrategia: c.link_estrategia,
      client_tipo_pacote: c.tipo_pacote,
      client_tipo_pacote_revisado: c.tipo_pacote_revisado,
      client_cadencia_reuniao: c.cadencia_reuniao,
      client_numero_unidades: c.numero_unidades,
      client_valor_trafego_google: c.valor_trafego_google,
      client_valor_trafego_meta: c.valor_trafego_meta,
      mes_referencia: mesReferencia,
      pacote_post: null,
      quantidade_postada: null,
      valor_trafego_mes: null,
      tpg_ativo: null,
      tpm_ativo: null,
      gmn_comentarios: 0,
      gmn_avaliacoes: 0,
      gmn_nota_media: null,
      gmn_observacoes: null,
      gmn_otimizado: false,
      gravacao_count: 0,
      steps: [],
    }));
  }

  const checklistIds = checklists.map((cl) => cl.id);

  // 3) Carrega steps de todos os checklists
  const { data: stepsData } = await supabase
    .from("checklist_step")
    .select("id, checklist_id, step_key, status, responsavel_id, iniciado_em, completed_at, completed_by, responsavel:profiles!checklist_step_responsavel_id_fkey(nome)")
    .in("checklist_id", checklistIds);

  const steps = (stepsData ?? []) as unknown as Array<{
    id: string;
    checklist_id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    responsavel: { nome: string } | null;
    iniciado_em: string | null;
    completed_at: string | null;
    completed_by: string | null;
  }>;

  // 3.5) Auto-derivar status "pronto" a partir de outras tabelas.
  // Quando dados reais mostram que algo foi feito (gravação entregue,
  // reunião agendada, tarefa de edição concluída/postada), marca o step
  // correspondente como pronto sem precisar de clique manual.
  // Marca manual via markStepProntoAction continua funcionando - quem chegar
  // primeiro grava `pronto` no banco.
  const { done: derivedDone, gravacaoCount } = await getDerivedDoneSet(supabase, mesReferencia, clientIds);
  // Cronograma fica pronto quando o cliente tem link_estrategia preenchido
  // (Drive, Gamma, etc.). O link é gerenciado na página /clientes/[id]/editar.
  for (const c of clients) {
    if (c.link_estrategia && c.link_estrategia.trim().length > 0) {
      derivedDone.add(`${c.id}:cronograma`);
    }
  }
  const checklistIdByClient = new Map(checklists.map((cl) => [cl.client_id, cl.id]));

  // 4) Agrupa steps por checklist, aplicando override de derivação
  const stepsByChecklist = new Map<string, ChecklistStepRow[]>();
  for (const s of steps) {
    const client = clients.find((c) => checklistIdByClient.get(c.id) === s.checklist_id);
    const derivedKey = client ? `${client.id}:${s.step_key}` : null;
    const isDerivedDone = derivedKey ? derivedDone.has(derivedKey) : false;
    const finalStatus: StepStatus = s.status === "pronto" || isDerivedDone ? "pronto" : s.status;

    const arr = stepsByChecklist.get(s.checklist_id) ?? [];
    arr.push({
      id: s.id,
      step_key: s.step_key,
      status: finalStatus,
      responsavel_id: s.responsavel_id,
      responsavel_nome: s.responsavel?.nome ?? null,
      iniciado_em: s.iniciado_em,
      completed_at: s.completed_at,
      completed_by: s.completed_by,
    });
    stepsByChecklist.set(s.checklist_id, arr);
  }

  // 5) Mapeia clientes → ChecklistRow
  // Index pra evitar O(n²) - antes era checklists.find() dentro do clients.map()
  const checklistByClient = new Map(checklists.map((cl) => [cl.client_id, cl]));
  return clients.map((c) => {
    const cl = checklistByClient.get(c.id);
    return {
      id: cl?.id ?? "",
      client_id: c.id,
      client_nome: c.nome,
      client_designer_id: c.designer_id,
      client_videomaker_id: c.videomaker_id,
      client_editor_id: c.editor_id,
      client_drive_url: c.drive_url,
      client_instagram_url: c.instagram_url,
      client_link_estrategia: c.link_estrategia,
      client_tipo_pacote: c.tipo_pacote,
      client_tipo_pacote_revisado: c.tipo_pacote_revisado,
      client_cadencia_reuniao: c.cadencia_reuniao,
      client_numero_unidades: c.numero_unidades,
      client_valor_trafego_google: c.valor_trafego_google,
      client_valor_trafego_meta: c.valor_trafego_meta,
      mes_referencia: mesReferencia,
      pacote_post: cl?.pacote_post ?? null,
      quantidade_postada: cl?.quantidade_postada ?? null,
      valor_trafego_mes: cl?.valor_trafego_mes ?? null,
      tpg_ativo: cl?.tpg_ativo ?? null,
      tpm_ativo: cl?.tpm_ativo ?? null,
      gmn_comentarios: cl?.gmn_comentarios ?? 0,
      gmn_avaliacoes: cl?.gmn_avaliacoes ?? 0,
      gmn_nota_media: cl?.gmn_nota_media ?? null,
      gmn_observacoes: cl?.gmn_observacoes ?? null,
      gmn_otimizado: cl?.gmn_otimizado ?? false,
      gravacao_count: gravacaoCount.get(c.id) ?? 0,
      steps: cl ? (stepsByChecklist.get(cl.id) ?? []) : [],
    };
  });
}

/**
 * Calcula intervalo UTC do mês BRT (Brasília UTC-3) pra um mes_referencia
 * "YYYY-MM". Retorna { startIso, endIso } em UTC pra usar em queries.
 *
 * Ex: "2026-05" → { startIso: "2026-05-01T03:00:00.000Z", endIso: "2026-06-01T03:00:00.000Z" }
 *
 * Garante que "Sunday 23:30 BRT" (= "Monday 02:30 UTC") do mês X seja
 * incluído no mês X em vez do mês X+1.
 */
function getMonthRangeBRT(mesReferencia: string): { startIso: string; endIso: string } {
  const [y, m] = mesReferencia.split("-").map(Number);
  // Midnight do primeiro dia do mês no fuso da app (Cuiabá UTC-4 = UTC dia 1 às 04:00)
  const offsetMs = getAppTimezoneOffsetMs(new Date(Date.UTC(y, m - 1, 1)));
  const startUtcMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) + offsetMs;
  const endUtcMs = Date.UTC(y, m, 1, 0, 0, 0, 0) + offsetMs;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

/**
 * Retorna um set de chaves "<client_id>:<step_key>" indicando quais steps
 * podem ser considerados PRONTOS automaticamente baseado em dados reais
 * de outras tabelas:
 *
 *   - camera:    qualquer captura entregue em audiovisual_capturas no mês
 *   - reuniao:   qualquer evento de calendário com client_id no mês
 *   - edicao:    qualquer task com tipo IN (video, arte) que avançou pra
 *                concluida/em_aprovacao/aprovada/agendado/postada no mês
 *   - postagem:  qualquer task com status=postada no mês (completed_at)
 *
 * MOB (mobile) fica de fora - o sistema não diferencia captura mobile vs
 * câmera profissional ainda. Marca manual pelo cell.
 */
/** Conta capturas (gravações) por client_id. Ignora linhas sem cliente. */
export function countGravacoesByClient(
  rows: Array<{ client_id: string | null }>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.client_id) continue;
    m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
  }
  return m;
}

async function getDerivedDoneSet(
  supabase: ReturnType<typeof createServiceRoleClient>,
  mesReferencia: string,
  clientIds: string[],
): Promise<{ done: Set<string>; gravacaoCount: Map<string, number> }> {
  if (clientIds.length === 0) return { done: new Set(), gravacaoCount: new Map() };

  const { startIso, endIso } = getMonthRangeBRT(mesReferencia);
  // data_captacao é DATE - usa formato YYYY-MM-DD
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Roda em paralelo as 4 queries de detecção
  const [capturasRes, eventosRes, tasksEdicaoRes, tasksPostagemRes] = await Promise.all([
    // CAM (camera) - qualquer captura entregue no mês
    sb
      .from("audiovisual_capturas")
      .select("client_id")
      .in("client_id", clientIds)
      .gte("data_captacao", startDate)
      .lt("data_captacao", endDate),
    // Reunião - só eventos do tipo "Assessores" (reunião de assessoria) com
    // client_id no mês. Usa o TIPO do evento (não quem criou) pra não contar
    // gravação (videomakers) ou outros eventos como reunião.
    sb
      .from("calendar_events")
      .select("client_id")
      .eq("sub_calendar", "assessores")
      .in("client_id", clientIds)
      .gte("inicio", startIso)
      .lt("inicio", endIso),
    // Edição - tasks de video/arte que avançaram no mês
    sb
      .from("tasks")
      .select("client_id, status, updated_at")
      .in("client_id", clientIds)
      .in("tipo", ["video", "arte"])
      .in("status", ["concluida", "em_aprovacao", "aprovada", "agendado", "postada"])
      .gte("updated_at", startIso)
      .lt("updated_at", endIso),
    // Postagem - tasks que foram postadas no mês
    sb
      .from("tasks")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .eq("status", "postada")
      .gte("completed_at", startIso)
      .lt("completed_at", endIso),
  ]);

  const done = new Set<string>();

  for (const row of (capturasRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (row.client_id) done.add(`${row.client_id}:camera`);
  }
  for (const row of (eventosRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (row.client_id) done.add(`${row.client_id}:reuniao`);
  }
  for (const row of (tasksEdicaoRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (row.client_id) done.add(`${row.client_id}:edicao`);
  }
  for (const row of (tasksPostagemRes.data ?? []) as Array<{ client_id: string | null }>) {
    if (row.client_id) done.add(`${row.client_id}:postagem`);
  }

  const gravacaoCount = countGravacoesByClient(
    (capturasRes.data ?? []) as Array<{ client_id: string | null }>,
  );

  return { done, gravacaoCount };
}
