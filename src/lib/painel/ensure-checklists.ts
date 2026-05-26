// src/lib/painel/ensure-checklists.ts
//
// Lógica core de criação idempotente de client_monthly_checklist +
// checklist_step pra um mês de referência. Extraída de `actions.ts` pra
// que crons e renderização server possam chamar sem o guard de role.
//
// O server action `ensureMonthlyChecklistsAction` segue existindo pro
// botão "Atualizar painel" — ele faz auth check e delega aqui.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getResponsavelFor } from "./chain";
import { PACOTES_NO_PAINEL_MENSAL, PACOTE_COLUMNS, type ColumnKey, type TipoPacote } from "./pacote-matrix";
import type { StepKey } from "./deadlines";

const COLUMN_TO_STEP: Record<ColumnKey, StepKey> = {
  crono: "cronograma",
  design: "design",
  tpg: "tpg",
  tpm: "tpm",
  gmn: "gmn_post",
  camera: "camera",
  mobile: "mobile",
  edicao: "edicao",
  reuniao: "reuniao",
  pacote_postados: "postagem",
};

export interface EnsureChecklistsResult {
  checklistsCriados: number;
  stepsCriados: number;
}

/**
 * Garante que existem `client_monthly_checklist` + `checklist_step` pra
 * cada cliente ativo elegível pro mês `mesRef` (formato YYYY-MM).
 * Idempotente — se já existe, não duplica.
 *
 * Usa service-role (RLS bloqueia INSERT pra users normais).
 */
export async function ensureMonthlyChecklistsImpl(
  mesRef: string,
): Promise<EnsureChecklistsResult> {
  const supabase = createServiceRoleClient();

  const { data: clientsData, error: clientsErr } = await supabase
    .from("clients")
    .select("id, organization_id, tipo_pacote, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id, pacote_post_padrao")
    .eq("status", "ativo")
    .in("tipo_pacote", [...PACOTES_NO_PAINEL_MENSAL]);
  if (clientsErr) throw new Error(clientsErr.message);

  const clients = (clientsData ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: TipoPacote;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
    pacote_post_padrao: number | null;
  }>;
  if (clients.length === 0) return { checklistsCriados: 0, stepsCriados: 0 };

  const clientIds = clients.map((c) => c.id);

  // Puxa também pacote_post existente pra detectar checklists antigos
  // com NULL — vamos preencher retroativamente com pacote_post_padrao.
  const { data: existingData } = await supabase
    .from("client_monthly_checklist")
    .select("id, client_id, pacote_post")
    .eq("mes_referencia", mesRef)
    .in("client_id", clientIds);
  const existing = (existingData ?? []) as Array<{ id: string; client_id: string; pacote_post: number | null }>;
  const existingByClient = new Map(existing.map((e) => [e.client_id, { id: e.id, pacote_post: e.pacote_post }]));

  // INSERT novos já com pacote_post pré-preenchido a partir do cliente.
  const toInsertChecklists = clients
    .filter((c) => !existingByClient.has(c.id))
    .map((c) => ({
      client_id: c.id,
      organization_id: c.organization_id,
      mes_referencia: mesRef,
      pacote_post: c.pacote_post_padrao,
    }));

  // UPDATE retroativo: checklists já criados antes dessa lógica ficaram com
  // pacote_post=null. Quando o cliente tem pacote_post_padrao definido,
  // preenchemos pra UI não mostrar 0/0.
  const toBackfill = clients.filter((c) => {
    if (c.pacote_post_padrao === null) return false;
    const ex = existingByClient.get(c.id);
    return ex !== undefined && ex.pacote_post === null;
  });
  if (toBackfill.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await Promise.all(
      toBackfill.map((c) =>
        sb
          .from("client_monthly_checklist")
          .update({ pacote_post: c.pacote_post_padrao })
          .eq("mes_referencia", mesRef)
          .eq("client_id", c.id),
      ),
    );
  }

  let checklistsCriados = 0;
  if (toInsertChecklists.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("client_monthly_checklist")
      .insert(toInsertChecklists)
      .select("id, client_id");
    if (insErr) throw new Error(insErr.message);
    checklistsCriados = inserted?.length ?? 0;
    for (const row of (inserted ?? []) as Array<{ id: string; client_id: string }>) {
      existingByClient.set(row.client_id, { id: row.id, pacote_post: null });
    }
  }

  const stepRowsToUpsert: Array<{
    checklist_id: string;
    step_key: StepKey;
    status: "pendente";
    responsavel_id: string | null;
  }> = [];

  for (const client of clients) {
    const ex = existingByClient.get(client.id);
    if (!ex) continue;
    const checklistId = ex.id;
    const columns = PACOTE_COLUMNS[client.tipo_pacote];
    for (const col of Object.keys(columns) as ColumnKey[]) {
      if (columns[col] !== 1) continue;
      const stepKey = COLUMN_TO_STEP[col];
      stepRowsToUpsert.push({
        checklist_id: checklistId,
        step_key: stepKey,
        status: "pendente",
        responsavel_id: getResponsavelFor(stepKey, {
          id: client.id,
          assessor_id: client.assessor_id,
          coordenador_id: client.coordenador_id,
          designer_id: client.designer_id,
          videomaker_id: client.videomaker_id,
          editor_id: client.editor_id,
        }),
      });
    }
  }

  let stepsCriados = 0;
  if (stepRowsToUpsert.length > 0) {
    const { data: upserted, error: stepsErr } = await supabase
      .from("checklist_step")
      .upsert(stepRowsToUpsert, {
        onConflict: "checklist_id,step_key",
        ignoreDuplicates: true,
      })
      .select("id");
    if (stepsErr) throw new Error(stepsErr.message);
    stepsCriados = upserted?.length ?? 0;
  }

  return { checklistsCriados, stepsCriados };
}
