import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateCalendar } from "./generator";
import { listPendingCalendars } from "./queries";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import type { ContentCalendarRow } from "./types";

const MAX_TENTATIVAS = 3;

interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  details: Array<{ id: string; status: "ok" | "erro"; error?: string }>;
}

export async function processContentCalendars(): Promise<WorkerResult> {
  const pending = await listPendingCalendars(3);
  const result: WorkerResult = {
    processed: pending.length,
    succeeded: 0,
    failed: 0,
    details: [],
  };

  for (const cal of pending) {
    try {
      await processOne(cal);
      result.succeeded++;
      result.details.push({ id: cal.id, status: "ok" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.details.push({ id: cal.id, status: "erro", error: msg });
      console.error(`[content-calendar-worker] Erro processando ${cal.id}:`, msg);
    }
  }

  return result;
}

async function processOne(cal: ContentCalendarRow): Promise<void> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  // Marcar como gerando
  await sbAny
    .from("content_calendars")
    .update({ status: "gerando", updated_at: new Date().toISOString() })
    .eq("id", cal.id);

  try {
    const { posts } = await generateCalendar(
      cal.id,
      cal.client_id,
      cal.mes_referencia,
      cal.modo,
    );

    // Marcar como gerado com os posts
    await sbAny
      .from("content_calendars")
      .update({
        status: "gerado",
        posts_json: posts,
        erro_msg: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cal.id);

    // Notificar assessor do cliente
    const { data: client } = await sbAny
      .from("clients")
      .select("assessor_id, nome")
      .eq("id", cal.client_id)
      .single();

    if (client?.assessor_id) {
      await dispatchNotification({
        evento_tipo: "task_assigned",
        titulo: "Cronograma de conteúdo gerado",
        mensagem: `O cronograma de ${cal.mes_referencia} do cliente "${client.nome}" foi gerado e está pronto para revisão.`,
        link: `/content-calendar/${cal.client_id}?mes=${cal.mes_referencia}`,
        user_ids_extras: [client.assessor_id],
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tentativas = cal.tentativas + 1;
    const novoStatus = tentativas >= MAX_TENTATIVAS ? "erro" : "pendente_geracao";

    await sbAny
      .from("content_calendars")
      .update({
        status: novoStatus,
        erro_msg: msg,
        tentativas,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cal.id);

    // Se esgotou tentativas, notificar
    if (novoStatus === "erro") {
      const { data: client } = await sbAny
        .from("clients")
        .select("assessor_id, nome")
        .eq("id", cal.client_id)
        .single();

      if (client?.assessor_id) {
        await dispatchNotification({
          evento_tipo: "task_assigned",
          titulo: "Erro ao gerar cronograma",
          mensagem: `Falha ao gerar cronograma de ${cal.mes_referencia} para "${client.nome}" após ${MAX_TENTATIVAS} tentativas: ${msg}`,
          link: `/content-calendar/${cal.client_id}?mes=${cal.mes_referencia}`,
          user_ids_extras: [client.assessor_id],
        });
      }
    }

    throw err; // re-throw para o worker contabilizar
  }
}
