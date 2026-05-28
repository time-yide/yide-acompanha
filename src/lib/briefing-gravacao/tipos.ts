// src/lib/briefing-gravacao/tipos.ts
//
// Tipos compartilhados do módulo de briefing/confirmação de gravação.

export type RoteiroTipo = "link" | "pdf";

export type StatusBriefing = "sem_roteiro" | "pendente" | "pronto";

/**
 * Subset dos campos de calendar_events relevantes pro cálculo de status.
 * Usado por status.ts (pura) e pelo componente de badge no calendário.
 */
export interface EventoBriefingInput {
  roteiro_tipo: RoteiroTipo | null;
  videomaker_leu_em: string | null;
  videomaker_imprimiu_em: string | null;
}

export interface BriefingPrintData {
  eventoId: string;
  clienteNome: string | null;
  inicio: string; // ISO
  fim: string;
  endereco: string | null;
  mapsUrl: string | null;
  observacoes: string | null;
  /** URL absoluta do roteiro (link externo OU signed URL do PDF). Null se sem roteiro. */
  roteiroUrl: string | null;
  roteiroTipo: RoteiroTipo | null;
  geradoPorNome: string;
}
