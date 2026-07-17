// src/lib/calendario/freela-events.ts
// Mapper puro: linha de freela_oportunidades -> CalendarEvent, pra a agenda de
// quem pegou. Sem IO (testável). A query fica em queries.ts.
import type { CalendarEvent } from "./schema";

export interface FreelaAgendaRow {
  id: string;
  titulo: string;
  data_hora: string | null;
  duracao_min: number;
  status: string;
  tipo: string;
  valor_comissao: number;
  entrega_urgente: boolean;
}

/**
 * Converte oportunidades pegas (com data_hora) em eventos de calendário.
 * `ownerId` entra em participantes_ids pra o filtro "meus" da agenda pegar.
 * Linhas sem data_hora são ignoradas (não há slot pra reservar).
 */
export function freelaRowsToEvents(rows: FreelaAgendaRow[], ownerId: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.data_hora) continue;
    const dur = r.duracao_min && r.duracao_min > 0 ? r.duracao_min : 60;
    const inicio = new Date(r.data_hora);
    const fim = new Date(inicio.getTime() + dur * 60_000);
    out.push({
      id: `freela-${r.id}`,
      origem: "freela",
      titulo: r.titulo,
      descricao: null,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      // sub_calendar audiovisual só pra satisfazer o tipo fechado; a cor vem do
      // ramo `event.freela` no EventCell/MonthView, não do sub_calendar.
      sub_calendar: "videomakers",
      participantes_ids: [ownerId],
      link: "/freela-yide",
      freela: {
        status: r.status,
        tipo: r.tipo,
        valor_comissao: r.valor_comissao,
        urgente: !!r.entrega_urgente,
      },
    });
  }
  return out;
}
