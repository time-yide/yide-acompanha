// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { isAtrasada, type StepKey, type StepStatus } from "@/lib/painel/deadlines";

const ALL_STEPS: StepKey[] = [
  "cronograma",
  "design",
  "tpg",
  "tpm",
  "valor_trafego",
  "gmn_post",
  "camera",
  "mobile",
  "edicao",
  "reuniao",
  "postagem",
];

export async function detectChecklistPainel(counters: { checklist_painel: number }): Promise<void> {
  const today = new Date();
  const isFirstDayOfMonth = today.getUTCDate() === 1;
  const monthRef = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  if (isFirstDayOfMonth) {
    await createChecklistsForActiveClients(monthRef, counters);
    // Skip atraso check on day 1 — steps were just created and cannot be overdue yet
    return;
  }

  await markAtrasadas(monthRef, today, counters);
}

async function createChecklistsForActiveClients(
  monthRef: string,
  counters: { checklist_painel: number },
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, assessor_id, organization_id, pacote_post_padrao")
    .eq("status", "ativo");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    assessor_id: string | null;
    organization_id: string;
    pacote_post_padrao: number | null;
  }>;

  if (clients.length === 0) return;

  const checklistsToInsert = clients.map((c) => ({
    client_id: c.id,
    organization_id: c.organization_id,
    mes_referencia: monthRef,
    pacote_post: c.pacote_post_padrao,
  }));

  const { data: insertedChecklists, error: insertErr } = await supabase
    .from("client_monthly_checklist")
    .upsert(checklistsToInsert, { onConflict: "client_id,mes_referencia", ignoreDuplicates: false })
    .select("id, client_id");

  if (insertErr || !insertedChecklists) {
    console.error("[checklist-painel] failed to upsert checklists:", insertErr?.message);
    return;
  }

  const checklists = insertedChecklists as Array<{ id: string; client_id: string }>;

  const stepsToInsert: Array<{
    checklist_id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    iniciado_em: string | null;
  }> = [];

  for (const checklist of checklists) {
    const cliente = clients.find((c) => c.id === checklist.client_id);
    if (!cliente) continue;

    for (const stepKey of ALL_STEPS) {
      const isCronograma = stepKey === "cronograma";
      stepsToInsert.push({
        checklist_id: checklist.id,
        step_key: stepKey,
        status: isCronograma ? "em_andamento" : "pendente",
        responsavel_id: isCronograma ? cliente.assessor_id : null,
        iniciado_em: isCronograma ? new Date().toISOString() : null,
      });
    }
  }

  await supabase.from("checklist_step").upsert(stepsToInsert, { onConflict: "checklist_id,step_key", ignoreDuplicates: true });

  // Notifica assessor de cada cliente
  for (const checklist of checklists) {
    const cliente = clients.find((c) => c.id === checklist.client_id);
    if (!cliente?.assessor_id) continue;
    await dispatchNotification({
      evento_tipo: "checklist_step_delegada",
      titulo: `Cronograma de ${monthRef} aguardando você`,
      mensagem: "Inicie o cronograma do mês no painel",
      link: "/painel",
      user_ids_extras: [cliente.assessor_id],
    });
  }

  counters.checklist_painel += clients.length;
}

async function markAtrasadas(
  monthRef: string,
  today: Date,
  counters: { checklist_painel: number },
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega steps não-prontos do mês corrente
  const { data: stepsData } = await supabase
    .from("checklist_step")
    .select("id, step_key, status, responsavel_id, checklist_id, client_monthly_checklist:client_monthly_checklist(mes_referencia)")
    .eq("client_monthly_checklist.mes_referencia", monthRef)
    .neq("status", "pronto");

  const steps = (stepsData ?? []) as unknown as Array<{
    id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    checklist_id: string;
  }>;

  for (const s of steps) {
    if (s.status === "atrasada") continue;
    if (isAtrasada(s.step_key, s.status, today)) {
      await supabase
        .from("checklist_step")
        .update({ status: "atrasada" })
        .eq("id", s.id);

      if (s.responsavel_id) {
        await dispatchNotification({
          evento_tipo: "checklist_step_atrasada",
          titulo: `Etapa "${s.step_key}" atrasada`,
          mensagem: "Conclua o quanto antes",
          link: "/painel",
          user_ids_extras: [s.responsavel_id],
        });
      }

      counters.checklist_painel++;
    }
  }
}
