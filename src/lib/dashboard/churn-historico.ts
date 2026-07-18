// SERVER-friendly, mas a parte de cálculo é pura (sem service-role) e testável.
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentMonthYM } from "@/lib/datetime/timezone";
import { isInMonth, lastDayOfMonth, monthRange, previousMonthYM } from "./date-utils";
import type { ClientFilter } from "./queries";

export interface ChurnClientRow {
  data_entrada: string;
  data_churn: string | null;
  valor_mensal: number;
  modalidade?: string | null;
  tipo_relacao?: string | null;
}

export interface ChurnMensalPoint {
  mes: string; // "YYYY-MM"
  churnPct: number | null; // null quando base = 0
  churns: number;
  valorPerdido: number;
}

const ehMensal = (c: ChurnClientRow) => !c.modalidade || c.modalidade === "mensal";
const ehComum = (c: ChurnClientRow) => !c.tipo_relacao || c.tipo_relacao === "comum";

/** Cliente ativo numa data (mesma regra de isActiveOn em queries.ts). */
function ativoEm(c: ChurnClientRow, dateIso: string): boolean {
  if (c.data_entrada > dateIso) return false;
  if (c.data_churn && c.data_churn <= dateIso) return false;
  return true;
}

/**
 * Churn % mês a mês. Só clientes MENSAIS COMUM entram (pontual/parceria fora).
 * base(M) = ativos no fim de M−1; churns(M) = data_churn em M.
 */
export function computeChurnMensal(
  clients: ChurnClientRow[],
  meses: string[],
): ChurnMensalPoint[] {
  const elegiveis = clients.filter((c) => ehMensal(c) && ehComum(c));
  return meses.map((mes) => {
    const fimAnterior = lastDayOfMonth(previousMonthYM(mes));
    const base = elegiveis.filter((c) => ativoEm(c, fimAnterior)).length;
    const churnsArr = elegiveis.filter((c) => isInMonth(c.data_churn, mes));
    const churns = churnsArr.length;
    const valorPerdido = churnsArr.reduce((acc, c) => acc + Number(c.valor_mensal), 0);
    return {
      mes,
      churnPct: base > 0 ? (churns / base) * 100 : null,
      churns,
      valorPerdido,
    };
  });
}

interface ClientFilterLike {
  unitId?: string | null;
  assessorId?: string | null;
  coordenadorId?: string | null;
}

async function _getChurnMensalHistoricoImpl(
  filter?: ClientFilterLike,
  ateMes?: string,
): Promise<ChurnMensalPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("clients")
    .select("data_entrada, data_churn, valor_mensal, modalidade, tipo_relacao")
    .is("deleted_at", null)
    .eq("tipo_relacao", "comum")
    .neq("status", "em_onboarding");
  // Mesmo escopo multi-tenant/assessor que buildClientFilterQuery (privado em queries.ts).
  if (filter?.unitId) q = q.eq("unit_id", filter.unitId);
  if (filter?.assessorId) q = q.eq("assessor_id", filter.assessorId);
  if (filter?.coordenadorId) q = q.eq("coordenador_id", filter.coordenadorId);

  const { data } = await q;
  const clients = ((data ?? []) as ChurnClientRow[]).filter((c) => !!c.data_entrada);
  if (clients.length === 0) return [];

  const fim = ateMes ?? getCurrentMonthYM();
  const inicio = clients.reduce(
    (min, c) => (c.data_entrada < min ? c.data_entrada : min),
    clients[0].data_entrada,
  ).slice(0, 7);

  const [iy, im] = inicio.split("-").map(Number);
  const [fy, fm] = fim.split("-").map(Number);
  const count = (fy - iy) * 12 + (fm - im) + 1;
  if (count <= 0) return [];
  const meses = monthRange(count, new Date(Date.UTC(fy, fm - 1, 1)));

  return computeChurnMensal(clients, meses);
}

/** Histórico de churn mensal (cacheado 5min, tag dashboard). */
export async function getChurnMensalHistorico(
  filter?: ClientFilter,
  ateMes?: string,
): Promise<ChurnMensalPoint[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { filter: f, ateMes: a } = JSON.parse(paramsJson) as {
        filter: ClientFilterLike | null;
        ateMes: string | null;
      };
      return _getChurnMensalHistoricoImpl(f ?? undefined, a ?? undefined);
    },
    ["dashboard-churn-historico-v1"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(JSON.stringify({ filter: filter ?? null, ateMes: ateMes ?? null }));
}
