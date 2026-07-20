// src/lib/cron/detectors/calendar-recurrence-extend.ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  expandRecurrence,
  addMonthsUTC,
  FOREVER_HORIZON_MONTHS,
  type RecurrenceRule,
} from "@/lib/calendario/recurrence";
import { brtInputToUtcIso, utcIsoToBrtInputValue } from "@/lib/calendario/timezone";

/**
 * Estende séries "forever" cujo fim está a menos de ~3 meses do horizonte.
 * Gera mais FOREVER_HORIZON_MONTHS meses a partir da última ocorrência.
 * Idempotente: só insere ocorrências com inicio > última existente.
 *
 * Timezone: as linhas guardam inicio/fim em ISO UTC. expandRecurrence trabalha
 * em wall-clock local ("YYYY-MM-DDTHH:mm"), então convertemos a última
 * ocorrência pra local com utcIsoToBrtInputValue, expandimos, e cada nova
 * ocorrência volta pra UTC com brtInputToUtcIso.
 */
export async function runCalendarRecurrenceExtend() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;
  const cutoffLocal = utcIsoToBrtInputValue(addMonthsUTC(new Date(), 3).toISOString());

  // Masters "forever" cuja regra ainda vale.
  const { data: masters, error } = await supabase
    .from("calendar_events")
    .select("id, series_id, recurrence_rule, titulo, descricao, sub_calendar, criado_por, participantes_ids, client_id, cliente_avulso, localizacao_endereco, localizacao_maps_url, link_roteiro, roteiro_tipo, roteiro_pdf_path, observacoes_gravacao, organization_id")
    .eq("recurrence_end_kind", "forever")
    .not("series_id", "is", null);
  if (error) return { error: error.message, extended: 0, insertedRows: 0 };

  let extendedSeries = 0;
  let insertedRows = 0;

  for (const m of (masters ?? []) as Array<Record<string, unknown>>) {
    const rule = m.recurrence_rule as unknown as RecurrenceRule | null;
    if (!rule || rule.endKind !== "forever") continue;

    // Última ocorrência da série.
    const { data: last } = await supabase
      .from("calendar_events")
      .select("inicio, fim")
      .eq("series_id", m.series_id as string)
      .order("inicio", { ascending: false })
      .limit(1)
      .single();
    if (!last) continue;

    const lastInicioLocal = utcIsoToBrtInputValue(last.inicio as string);
    const lastFimLocal = utcIsoToBrtInputValue(last.fim as string);

    // Só estende se o fim da série está chegando (< cutoff).
    if (lastInicioLocal > cutoffLocal) continue;

    const newHorizon = addMonthsUTC(new Date(), FOREVER_HORIZON_MONTHS);
    // Reexpande a partir da última ocorrência; descarta as <= última (duplicatas).
    const occ = expandRecurrence(rule, lastInicioLocal, lastFimLocal, newHorizon)
      .filter((o) => o.inicio > lastInicioLocal);
    if (occ.length === 0) continue;

    const rows = occ.map((o) => ({
      organization_id: m.organization_id,
      titulo: m.titulo,
      descricao: m.descricao,
      sub_calendar: m.sub_calendar,
      criado_por: m.criado_por,
      participantes_ids: (m.participantes_ids as string[] | null) ?? [],
      client_id: m.client_id,
      cliente_avulso: m.cliente_avulso,
      localizacao_endereco: m.localizacao_endereco,
      localizacao_maps_url: m.localizacao_maps_url,
      link_roteiro: m.link_roteiro,
      roteiro_tipo: m.roteiro_tipo,
      roteiro_pdf_path: m.roteiro_pdf_path,
      observacoes_gravacao: m.observacoes_gravacao,
      inicio: brtInputToUtcIso(o.inicio),
      fim: brtInputToUtcIso(o.fim),
      series_id: m.series_id,
      recurrence_rule: null,
      recurrence_end_kind: null,
    }));

    const { error: insErr, count } = await supabase
      .from("calendar_events")
      .insert(rows, { count: "exact" });
    if (!insErr) {
      extendedSeries += 1;
      insertedRows += count ?? rows.length;
    }
  }

  return { extended: extendedSeries, insertedRows };
}
