// SERVER ONLY: do not import from client components
export type Periodo = "mes_atual" | "mes_anterior" | "dias_7" | "total";

export function resolvePeriodo(periodo: Periodo, reference: Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const ref = new Date(reference);
  if (periodo === "mes_anterior") {
    const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }
  if (periodo === "dias_7") {
    const from = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { fromIso: from.toISOString(), toIso: ref.toISOString() };
  }
  if (periodo === "total") {
    return { fromIso: "1970-01-01T00:00:00.000Z", toIso: "2999-12-31T23:59:59.999Z" };
  }
  // default: mes_atual
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}
