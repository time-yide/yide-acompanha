// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import type { StepKey, StepStatus } from "./deadlines";

export interface ChecklistFilter {
  assessorId?: string;
  coordenadorId?: string;
  designerId?: string;
  videomakerId?: string;
  editorId?: string;
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
  mes_referencia: string;
  pacote_post: number | null;
  quantidade_postada: number | null;
  valor_trafego_mes: number | null;
  steps: ChecklistStepRow[];
}

export async function getMonthlyChecklists(
  mesReferencia: string,
  filter: ChecklistFilter = {},
): Promise<ChecklistRow[]> {
  const supabase = await createClient();

  // 1) Lista clientes filtrados
  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id, drive_url, instagram_url")
    .eq("status", "ativo");

  if (filter.assessorId) clientsQuery = clientsQuery.eq("assessor_id", filter.assessorId);
  if (filter.coordenadorId) clientsQuery = clientsQuery.eq("coordenador_id", filter.coordenadorId);
  if (filter.designerId) clientsQuery = clientsQuery.eq("designer_id", filter.designerId);
  if (filter.videomakerId) clientsQuery = clientsQuery.eq("videomaker_id", filter.videomakerId);
  if (filter.editorId) clientsQuery = clientsQuery.eq("editor_id", filter.editorId);

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
  }>;

  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // 2) Carrega checklists do mês
  const { data: checklistsData } = await supabase
    .from("client_monthly_checklist")
    .select("id, client_id, mes_referencia, pacote_post, quantidade_postada, valor_trafego_mes")
    .eq("mes_referencia", mesReferencia)
    .in("client_id", clientIds);

  const checklists = (checklistsData ?? []) as Array<{
    id: string;
    client_id: string;
    mes_referencia: string;
    pacote_post: number | null;
    quantidade_postada: number | null;
    valor_trafego_mes: number | null;
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
      mes_referencia: mesReferencia,
      pacote_post: null,
      quantidade_postada: null,
      valor_trafego_mes: null,
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

  // 4) Agrupa steps por checklist
  const stepsByChecklist = new Map<string, ChecklistStepRow[]>();
  for (const s of steps) {
    const arr = stepsByChecklist.get(s.checklist_id) ?? [];
    arr.push({
      id: s.id,
      step_key: s.step_key,
      status: s.status,
      responsavel_id: s.responsavel_id,
      responsavel_nome: s.responsavel?.nome ?? null,
      iniciado_em: s.iniciado_em,
      completed_at: s.completed_at,
      completed_by: s.completed_by,
    });
    stepsByChecklist.set(s.checklist_id, arr);
  }

  // 5) Mapeia clientes → ChecklistRow
  return clients.map((c) => {
    const cl = checklists.find((x) => x.client_id === c.id);
    return {
      id: cl?.id ?? "",
      client_id: c.id,
      client_nome: c.nome,
      client_designer_id: c.designer_id,
      client_videomaker_id: c.videomaker_id,
      client_editor_id: c.editor_id,
      client_drive_url: c.drive_url,
      client_instagram_url: c.instagram_url,
      mes_referencia: mesReferencia,
      pacote_post: cl?.pacote_post ?? null,
      quantidade_postada: cl?.quantidade_postada ?? null,
      valor_trafego_mes: cl?.valor_trafego_mes ?? null,
      steps: cl ? (stepsByChecklist.get(cl.id) ?? []) : [],
    };
  });
}
