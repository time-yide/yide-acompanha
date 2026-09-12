import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface CallContext {
  callId: string;
  orgId: string;
  leadGeradoId: string | null;
  iniciado_por: string;
}

export async function handleAgendarReuniao(
  args: { data: string; horario: string; duracao_minutos?: number },
  ctx: CallContext,
): Promise<string> {
  const sb = createServiceRoleClient() as any;
  const duracao = args.duracao_minutos ?? 30;

  const inicioBrt = `${args.data}T${args.horario}:00`;
  const inicioDate = new Date(inicioBrt + "-03:00");
  const fimDate = new Date(inicioDate.getTime() + duracao * 60_000);

  let empresaNome = "Lead";
  if (ctx.leadGeradoId) {
    const { data: lead } = await sb
      .from("leads_gerados")
      .select("empresa")
      .eq("id", ctx.leadGeradoId)
      .single();
    if (lead?.empresa) empresaNome = lead.empresa;
  }

  const { data: evento, error } = await sb
    .from("calendar_events")
    .insert({
      organization_id: ctx.orgId,
      titulo: `Reunião comercial — ${empresaNome}`,
      descricao: `Reunião agendada pela IA de voz com ${empresaNome}.`,
      inicio: inicioDate.toISOString(),
      fim: fimDate.toISOString(),
      sub_calendar: "comercial",
      criado_por: ctx.iniciado_por,
      participantes_ids: [ctx.iniciado_por],
    })
    .select("id")
    .single();

  if (error) {
    console.error("[voz-ia] erro ao criar evento:", error.message);
    return "Erro ao agendar. Peça desculpas e tente confirmar a data verbalmente.";
  }

  await sb.from("ai_voice_calls").update({
    status: "reuniao_agendada",
    calendar_event_id: evento.id,
    reuniao_data: inicioDate.toISOString(),
    resultado_detalhe: `Reunião ${args.data} às ${args.horario}`,
  }).eq("id", ctx.callId);

  if (ctx.leadGeradoId) {
    await sb.from("leads_gerados").update({
      status: "reuniao_marcada",
      ai_status: "reuniao_agendada",
    }).eq("id", ctx.leadGeradoId);
  }

  return `Reunião agendada com sucesso para ${args.data} às ${args.horario}. Confirme com o lead e encerre a chamada.`;
}

export async function handleMarcarSemInteresse(
  args: { motivo?: string },
  ctx: CallContext,
): Promise<string> {
  const sb = createServiceRoleClient() as any;

  await sb.from("ai_voice_calls").update({
    status: "sem_interesse",
    resultado_detalhe: args.motivo ?? "Lead recusou",
  }).eq("id", ctx.callId);

  if (ctx.leadGeradoId) {
    await sb.from("leads_gerados").update({
      status: "descartado",
      ai_status: "sem_interesse",
      observacoes: args.motivo ? `IA: ${args.motivo}` : "IA: lead sem interesse",
    }).eq("id", ctx.leadGeradoId);
  }

  return "Registrado. Agradeça educadamente e encerre a chamada.";
}
