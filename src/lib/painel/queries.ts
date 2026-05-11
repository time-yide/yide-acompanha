// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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
    ["painel-monthly-checklists-v1"],
    { revalidate: 60, tags: [PAINEL_CACHE_TAG] },
  );
  return cached(mesReferencia, JSON.stringify(filter));
}

async function _getMonthlyChecklistsImpl(
  mesReferencia: string,
  filter: ChecklistFilter,
): Promise<ChecklistRow[]> {
  const supabase = createServiceRoleClient();

  // 1) Lista clientes filtrados (apenas pacotes do painel mensal)
  let clientsQuery = supabase
    .from("clients")
    .select(`
      id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id,
      drive_url, instagram_url,
      tipo_pacote, tipo_pacote_revisado, cadencia_reuniao, numero_unidades,
      valor_trafego_google, valor_trafego_meta
    `)
    .eq("status", "ativo")
    .in("tipo_pacote", [
      "trafego_estrategia", "trafego", "estrategia", "audiovisual", "yide_360",
    ]);

  if (filter.assessorId) clientsQuery = clientsQuery.eq("assessor_id", filter.assessorId);
  if (filter.coordenadorId) clientsQuery = clientsQuery.eq("coordenador_id", filter.coordenadorId);
  if (filter.designerId) clientsQuery = clientsQuery.eq("designer_id", filter.designerId);
  if (filter.videomakerId) clientsQuery = clientsQuery.eq("videomaker_id", filter.videomakerId);
  if (filter.editorId) clientsQuery = clientsQuery.eq("editor_id", filter.editorId);
  if (filter.audiovisualUserId) {
    clientsQuery = clientsQuery.or(
      `videomaker_id.eq.${filter.audiovisualUserId},editor_id.eq.${filter.audiovisualUserId}`,
    );
  }

  const { data: clientsData } = await clientsQuery.order("nome");
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
    drive_url: string | null;
    instagram_url: string | null;
    tipo_pacote: TipoPacote;
    tipo_pacote_revisado: boolean;
    cadencia_reuniao: CadenciaReuniao | null;
    numero_unidades: number;
    valor_trafego_google: number | null;
    valor_trafego_meta: number | null;
  }>;

  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // 2) Carrega checklists do mês
  const { data: checklistsData } = await supabase
    .from("client_monthly_checklist")
    .select(`
      id, client_id, mes_referencia,
      pacote_post, quantidade_postada, valor_trafego_mes,
      tpg_ativo, tpm_ativo,
      gmn_comentarios, gmn_avaliacoes, gmn_nota_media, gmn_observacoes
    `)
    .eq("mes_referencia", mesReferencia)
    .in("client_id", clientIds);

  const checklists = (checklistsData ?? []) as Array<{
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
  }>;

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
  // Marca manual via markStepProntoAction continua funcionando — quem chegar
  // primeiro grava `pronto` no banco.
  const derivedDone = await getDerivedDoneSet(supabase, mesReferencia, clientIds);
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
  // Index pra evitar O(n²) — antes era checklists.find() dentro do clients.map()
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
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const [y, m] = mesReferencia.split("-").map(Number);
  // BRT midnight do primeiro dia do mês = UTC dia 1 às 03:00
  const startUtcMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) + BRT_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m, 1, 0, 0, 0, 0) + BRT_OFFSET_MS;
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
 *   - camera:    captura entregue por user role=videomaker no mês
 *   - mobile:    captura entregue por user role=videomaker_mobile no mês
 *   - reuniao:   qualquer evento de calendário com client_id no mês
 *   - edicao:    qualquer task com tipo IN (video, arte) que avançou pra
 *                concluida/em_aprovacao/aprovada/agendado/postada no mês
 *   - postagem:  qualquer task com status=postada no mês (completed_at)
 */
async function getDerivedDoneSet(
  supabase: ReturnType<typeof createServiceRoleClient>,
  mesReferencia: string,
  clientIds: string[],
): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set();

  const { startIso, endIso } = getMonthRangeBRT(mesReferencia);
  // data_captacao é DATE — usa formato YYYY-MM-DD
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Roda em paralelo as 4 queries de detecção
  const [capturasRes, eventosRes, tasksEdicaoRes, tasksPostagemRes] = await Promise.all([
    // Capturas entregues — diferencia CAM vs MOB pelo role do videomaker:
    //   role=videomaker        → step `camera`
    //   role=videomaker_mobile → step `mobile`
    sb
      .from("audiovisual_capturas")
      .select("client_id, videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(role)")
      .in("client_id", clientIds)
      .gte("data_captacao", startDate)
      .lt("data_captacao", endDate),
    // Reunião — qualquer evento com client_id no mês
    sb
      .from("calendar_events")
      .select("client_id")
      .in("client_id", clientIds)
      .gte("inicio", startIso)
      .lt("inicio", endIso),
    // Edição — tasks de video/arte que avançaram no mês
    sb
      .from("tasks")
      .select("client_id, status, updated_at")
      .in("client_id", clientIds)
      .in("tipo", ["video", "arte"])
      .in("status", ["concluida", "em_aprovacao", "aprovada", "agendado", "postada"])
      .gte("updated_at", startIso)
      .lt("updated_at", endIso),
    // Postagem — tasks que foram postadas no mês
    sb
      .from("tasks")
      .select("client_id, completed_at")
      .in("client_id", clientIds)
      .eq("status", "postada")
      .gte("completed_at", startIso)
      .lt("completed_at", endIso),
  ]);

  const done = new Set<string>();

  for (const row of (capturasRes.data ?? []) as Array<{
    client_id: string | null;
    videomaker: { role: string } | null;
  }>) {
    if (!row.client_id) continue;
    // Mobile → step `mobile`. Outros (videomaker padrão, ausente ou outro) → `camera`.
    if (row.videomaker?.role === "videomaker_mobile") {
      done.add(`${row.client_id}:mobile`);
    } else {
      done.add(`${row.client_id}:camera`);
    }
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

  return done;
}
