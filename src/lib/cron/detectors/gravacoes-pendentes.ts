// src/lib/cron/detectors/gravacoes-pendentes.ts
//
// SERVER ONLY. Roda no cron de 5min. Pra cada gravação futura, decide
// se está na janela de notificação 24h / 3h / 2h / sem-roteiro e dispara
// via dispatchNotification (com idempotência por timestamp na linha).

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

export type Janela = "24h" | "3h" | "2h";

const CENTROS: Record<Janela, number> = { "24h": 24 * 60, "3h": 3 * 60, "2h": 2 * 60 };
const TOLERANCIA_MIN = 5;

export function dentroDaJanela(minutosAteInicio: number, janela: Janela): boolean {
  const centro = CENTROS[janela];
  return Math.abs(minutosAteInicio - centro) <= TOLERANCIA_MIN;
}

export function calcMinutosAteInicio(inicioIso: string, now: Date): number {
  return Math.round((new Date(inicioIso).getTime() - now.getTime()) / 60000);
}

interface CounterShape {
  gravacao_pendente_24h: number;
  gravacao_pendente_3h: number;
  gravacao_alerta_2h: number;
  gravacao_sem_roteiro: number;
}

interface EventoRow {
  id: string;
  titulo: string;
  inicio: string;
  criado_por: string;
  participantes_ids: string[];
  roteiro_tipo: "link" | "pdf" | null;
  videomaker_leu_em: string | null;
  videomaker_imprimiu_em: string | null;
  notif_24h_enviada_em: string | null;
  notif_3h_enviada_em: string | null;
  notif_2h_alert_enviada_em: string | null;
  notif_sem_roteiro_enviada_em: string | null;
}

export async function detectGravacoesPendentes(
  counters: CounterShape,
  nowOverride?: Date,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = nowOverride ?? new Date();
  const lo = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const hi = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("calendar_events")
    .select(
      `id, titulo, inicio, criado_por, participantes_ids,
       roteiro_tipo, videomaker_leu_em, videomaker_imprimiu_em,
       notif_24h_enviada_em, notif_3h_enviada_em,
       notif_2h_alert_enviada_em, notif_sem_roteiro_enviada_em`,
    )
    .eq("sub_calendar", "videomakers")
    .gte("inicio", lo)
    .lt("inicio", hi);

  const eventos = (data ?? []) as EventoRow[];

  for (const e of eventos) {
    const mins = calcMinutosAteInicio(e.inicio, now);
    const pronto = !!(e.videomaker_leu_em && e.videomaker_imprimiu_em);

    if (
      dentroDaJanela(mins, "24h") &&
      !e.notif_24h_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null &&
      e.participantes_ids.length > 0
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_pendente_24h" as any,
        titulo: `Em 24h: gravação ${e.titulo}`,
        mensagem: "Leia o roteiro e marque como impresso pra liberar o endereço.",
        link: `/calendario/${e.id}`,
        user_ids_extras: e.participantes_ids,
      });
      await marcarEnviada(supabase, e.id, "notif_24h_enviada_em");
      counters.gravacao_pendente_24h++;
    }

    if (
      dentroDaJanela(mins, "3h") &&
      !e.notif_3h_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null &&
      e.participantes_ids.length > 0
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_pendente_3h" as any,
        titulo: `Em 3h: gravação ${e.titulo}`,
        mensagem: "Última chance de ler e imprimir antes da gravação.",
        link: `/calendario/${e.id}`,
        user_ids_extras: e.participantes_ids,
      });
      await marcarEnviada(supabase, e.id, "notif_3h_enviada_em");
      counters.gravacao_pendente_3h++;
    }

    if (
      dentroDaJanela(mins, "2h") &&
      !e.notif_2h_alert_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null
    ) {
      const optInIds = await getAdmSocioOptInIds(supabase);
      const extras = Array.from(
        new Set([e.criado_por, ...optInIds].filter(Boolean)),
      );
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_alerta_2h" as any,
        titulo: `Alerta: gravação ${e.titulo} em 2h sem confirmação`,
        mensagem: `O videomaker ainda não confirmou leitura/impressão. Hora ${fmtHora(e.inicio)}.`,
        link: `/calendario/${e.id}`,
        user_ids_extras: extras,
      });
      await marcarEnviada(supabase, e.id, "notif_2h_alert_enviada_em");
      counters.gravacao_alerta_2h++;
    }

    if (
      dentroDaJanela(mins, "24h") &&
      !e.notif_sem_roteiro_enviada_em &&
      e.roteiro_tipo === null
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_sem_roteiro" as any,
        titulo: `Gravação ${e.titulo} amanhã sem roteiro`,
        mensagem: "Anexe o link ou PDF do roteiro pra liberar a leitura do videomaker.",
        link: `/calendario/${e.id}`,
        user_ids_extras: [e.criado_por],
      });
      await marcarEnviada(supabase, e.id, "notif_sem_roteiro_enviada_em");
      counters.gravacao_sem_roteiro++;
    }
  }
}

async function marcarEnviada(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  eventoId: string,
  campo: string,
): Promise<void> {
  await supabase
    .from("calendar_events")
    .update({ [campo]: new Date().toISOString() })
    .eq("id", eventoId)
    .is(campo, null);
}

async function getAdmSocioOptInIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["adm", "socio"])
    .eq("notif_alerta_gravacao_pendente", true);
  return (data ?? []).map((r: { id: string }) => r.id);
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}
