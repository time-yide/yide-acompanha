// SERVER ONLY: helpers puros pra cálculo de janelas BRT e timestamp de "concluído"

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // BRT = UTC-3

/**
 * Calcula intervalos pra "hoje BRT" e "futuro de amanhã até N semanas".
 * Retorna ISOs UTC. Os intervalos são contínuos: futuroFromIso == hojeToIso.
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
  // Converte ref UTC pra "data BRT" subtraindo offset
  const brtNow = new Date(reference.getTime() - BRT_OFFSET_MS);
  // Início do dia BRT (00:00) — em data UTC, isso é dia BRT às 03:00 UTC
  const hojeFromUTC = new Date(Date.UTC(
    brtNow.getUTCFullYear(),
    brtNow.getUTCMonth(),
    brtNow.getUTCDate(),
    0, 0, 0, 0,
  ));
  // Adiciona offset pra converter pra UTC real
  const hojeFromMs = hojeFromUTC.getTime() + BRT_OFFSET_MS;
  const hojeToMs = hojeFromMs + 24 * 60 * 60 * 1000;
  const futuroToMs = hojeFromMs + (weeksAhead * 7) * 24 * 60 * 60 * 1000;

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
