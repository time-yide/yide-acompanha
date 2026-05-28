// src/lib/briefing-gravacao/status.ts
//
// Função pura: dado os campos relevantes de um calendar_event, retorna o
// status do briefing. Usada pelo badge no calendário, pelo card de detalhe
// e pelo cron de notificações.

import type { EventoBriefingInput, StatusBriefing } from "./tipos";

export function computaStatus(e: EventoBriefingInput): StatusBriefing {
  if (e.roteiro_tipo === null) return "sem_roteiro";
  if (e.videomaker_leu_em && e.videomaker_imprimiu_em) return "pronto";
  return "pendente";
}
