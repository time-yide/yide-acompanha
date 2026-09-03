"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function alinharGravacaoAction(
  alertId: string,
  data: {
    data_gravacao: string;
    horario_inicio: string;
    horario_fim: string;
    local: string;
    observacoes?: string;
  },
): Promise<ActionResult> {
  const user = await requireAuth();
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  const { data: alert, error } = await sbAny
    .from("recording_scheduling_alerts")
    .select("*, clients!inner(nome, organization_id)")
    .eq("id", alertId)
    .single();
  if (error || !alert)
    return { success: false, error: "Alerta nao encontrado" };

  const eventDate = new Date(data.data_gravacao);
  const [hI, mI] = data.horario_inicio.split(":");
  const [hF, mF] = data.horario_fim.split(":");

  const startAt = new Date(eventDate);
  startAt.setHours(parseInt(hI), parseInt(mI), 0);
  const endAt = new Date(eventDate);
  endAt.setHours(parseInt(hF), parseInt(mF), 0);

  const { data: event, error: eventErr } = await sbAny
    .from("calendar_events")
    .insert({
      organization_id: alert.clients.organization_id,
      titulo: `Gravacao — ${alert.clients.nome}`,
      descricao: data.observacoes ?? null,
      local: data.local,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      sub_calendar: "videomaker",
      client_id: alert.client_id,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (eventErr)
    return { success: false, error: eventErr.message };

  await sbAny
    .from("recording_scheduling_alerts")
    .update({
      status: "alinhado_cliente",
      data_gravacao: startAt.toISOString(),
      horario_inicio: data.horario_inicio,
      horario_fim: data.horario_fim,
      local: data.local,
      observacoes: data.observacoes ?? null,
      calendar_event_id: event?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  await dispatchNotification({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evento_tipo: "gravacao_alinhada" as any,
    titulo: "Gravacao alinhada",
    mensagem: `Gravacao de ${alert.clients.nome} alinhada para ${new Date(data.data_gravacao).toLocaleDateString("pt-BR")}. Delegue o videomaker.`,
    link: "/audiovisual/pendencias-gravacao",
    source_user_id: user.id,
  });

  revalidatePath("/audiovisual");
  return { success: true };
}

export async function delegarGravacaoAction(
  alertId: string,
  videomakerId: string,
): Promise<ActionResult> {
  await requireAuth();
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;

  await sbAny
    .from("recording_scheduling_alerts")
    .update({
      status: "agendado",
      videomaker_id: videomakerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  const { data: alert } = await sbAny
    .from("recording_scheduling_alerts")
    .select("calendar_event_id")
    .eq("id", alertId)
    .single();

  if (alert?.calendar_event_id) {
    await sbAny
      .from("calendar_events")
      .update({ atribuido_a: videomakerId })
      .eq("id", alert.calendar_event_id);
  }

  revalidatePath("/audiovisual");
  return { success: true };
}
