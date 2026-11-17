import "server-only";
import type { WeeklyReportData } from "./types";

const ZERO = { valor: 0, anterior: 0, variacao_pct: 0 };

/**
 * Weekly report generator — social media metrics were removed.
 * Returns an empty report structure so callers don't break.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateWeeklyReport(
  _clientId: string, _orgId: string, _semanaInicio: string, _semanaFim: string,
): Promise<WeeklyReportData> {
  return {
    posts_publicados: 0,
    posts_detalhes: [],
    metricas: {
      alcance: { ...ZERO },
      curtidas: { ...ZERO },
      comentarios: { ...ZERO },
      salvamentos: { ...ZERO },
      compartilhamentos: { ...ZERO },
      engajamento_total: { ...ZERO },
    },
  };
}
