import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ToolCallResult } from "./conversa-ia-types";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

export async function handleAgendarReuniao(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { data: string; horario: string; duracao_minutos?: number },
): Promise<ToolCallResult> {
  const duracao = args.duracao_minutos ?? 30;
  const inicio = new Date(`${args.data}T${args.horario}:00-04:00`);
  const fim = new Date(inicio.getTime() + duracao * 60000);

  await sb().from("calendar_events").insert({
    organization_id: orgId,
    titulo: "Reunião de apresentação (IA)",
    descricao: "Reunião agendada automaticamente pela IA via WhatsApp",
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    sub_calendar: "comercial",
    origem: "lead_prospeccao",
    dia_inteiro: false,
  });

  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({
        status: "reuniao_marcada",
        ai_status: "reuniao_agendada",
      })
      .eq("id", leadGeradoId);

    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "whatsapp",
      canal: "whatsapp",
      resultado: "agendou",
      notas: `Reunião agendada pela IA: ${args.data} às ${args.horario}`,
    }).catch(() => {});

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "reuniao_agendada",
      modelo: "wpp_direto",
      detalhes: { data: args.data, horario: args.horario, duracao, conversation_id: conversationId },
    });
  }

  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "agendar_reuniao", success: true, message: "Reunião agendada" };
}

export async function handleMarcarSemInteresse(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { motivo: string },
): Promise<ToolCallResult> {
  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({
        status: "descartado",
        ai_status: "sem_interesse",
        motivo_descarte: args.motivo,
      })
      .eq("id", leadGeradoId);

    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "whatsapp",
      canal: "whatsapp",
      resultado: "recusou",
      notas: `Sem interesse: ${args.motivo}`,
    }).catch(() => {});

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "sem_interesse",
      modelo: "wpp_direto",
      detalhes: { motivo: args.motivo, conversation_id: conversationId },
    });
  }

  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "marcar_sem_interesse", success: true };
}

export async function handleEscalarHumano(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { motivo: string },
): Promise<ToolCallResult> {
  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  const { data: admins } = await sb()
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .in("role", ["adm", "socio"]);

  if (admins && admins.length > 0) {
    const { data: conv } = await sb()
      .from("wpp_conversations")
      .select("contato_nome")
      .eq("id", conversationId)
      .single();

    const nome = conv?.contato_nome ?? "Lead";

    const notifs = (admins as { id: string }[]).map((a) => ({
      user_id: a.id,
      organization_id: orgId,
      tipo: "wpp_escalacao",
      titulo: `${nome} pediu pra falar com humano`,
      mensagem: args.motivo,
      link: `/conversas`,
    }));

    await sb().from("notifications").insert(notifs).catch(() => {});
  }

  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({ ai_status: "escalado_humano" })
      .eq("id", leadGeradoId);

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "escalado_humano",
      modelo: "wpp_direto",
      detalhes: { motivo: args.motivo, conversation_id: conversationId },
    });
  }

  return { action: "escalar_humano", success: true };
}

export async function handleEncerrarConversa(
  conversationId: string,
): Promise<ToolCallResult> {
  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "encerrar_conversa", success: true };
}
