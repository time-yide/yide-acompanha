// Helpers puros pra modalidade=pontual. Um pontual é um serviço único que
// "vale" pelo mês em que entrou e encerra no fim desse mês.
import { lastDayOfMonth } from "@/lib/dashboard/date-utils";

/** Data de conclusão de um pontual = último dia do mês de `data_entrada` (YYYY-MM-DD). */
export function dataConclusaoPontual(dataEntrada: string): string {
  return lastDayOfMonth(dataEntrada.slice(0, 7));
}

/**
 * `true` se o mês de entrada do pontual já terminou em relação a `hojeIso`
 * (ambos 'YYYY-MM-DD'). No último dia do mês ainda retorna `false` (vigente).
 */
export function pontualMesEncerrado(dataEntrada: string, hojeIso: string): boolean {
  return dataConclusaoPontual(dataEntrada) < hojeIso;
}
