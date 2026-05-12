// SERVER ONLY: helpers puros pra cálculo de janelas no fuso da app
// (America/Cuiaba) e timestamp de "concluído".

import { getAppTimezoneOffsetMs, getDatePartsInAppTz } from "@/lib/datetime/timezone";

/**
 * Calcula intervalos pra "hoje" e "futuro de amanhã até N semanas" no fuso
 * da app (Cuiabá UTC-4, sem DST). Retorna ISOs UTC pra usar em queries
 * Supabase. Os intervalos são contínuos: futuroFromIso == hojeToIso.
 */
export function getHojeAndFuturoBRT(
  weeksAhead = 2,
  reference: Date = new Date(),
): {
  hojeFromIso: string;
  hojeToIso: string;
  futuroFromIso: string;
  futuroToIso: string;
} {
  // Pega o dia (Y/M/D) ATUAL no fuso da app via Intl, então constrói a
  // janela em UTC. Usa offset dinâmico (suporta DST se um dia mudar TZ).
  const parts = getDatePartsInAppTz(reference);
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);

  // Offset positivo (Cuiabá = +4h pra add em UTC pra obter wall-clock)
  const offsetMs = getAppTimezoneOffsetMs(reference);

  // Início do dia no fuso da app (wall-clock 00:00) → equivalente em UTC
  const hojeFromMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs;
  const hojeToMs = hojeFromMs + 24 * 60 * 60 * 1000;
  const futuroToMs = hojeFromMs + weeksAhead * 7 * 24 * 60 * 60 * 1000;

  return {
    hojeFromIso: new Date(hojeFromMs).toISOString(),
    hojeToIso: new Date(hojeToMs).toISOString(),
    futuroFromIso: new Date(hojeToMs).toISOString(),
    futuroToIso: new Date(futuroToMs).toISOString(),
  };
}

/**
 * Retorna o timestamp ISO que representa "quando a task foi finalizada",
 * dependendo do status. Usado pra filtrar "concluídas no período".
 *
 * Mapeamento:
 *   concluida  -> completed_at
 *   aprovada   -> aprovada_em ?? completed_at
 *   postada    -> completed_at ?? aprovada_em
 *   em_aprovacao / agendado -> updated_at
 *   outros -> null
 */
export function getTerminadoEm(task: {
  status: string;
  completed_at: string | null;
  aprovada_em: string | null;
  updated_at: string | null;
}): string | null {
  switch (task.status) {
    case "concluida":
      return task.completed_at;
    case "aprovada":
      return task.aprovada_em ?? task.completed_at;
    case "postada":
      return task.completed_at ?? task.aprovada_em;
    case "em_aprovacao":
    case "agendado":
      return task.updated_at;
    default:
      return null;
  }
}
