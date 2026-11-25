// Prazo padrão da edição de uma captação. Client-safe.
import { addDiasUteis, isYmd, prazoEdicaoPadrao, PRAZO_EDICAO_DIAS_UTEIS } from "@/lib/datas/dias-uteis";
import { formatIsoDate } from "@/lib/datetime/timezone";

/** Prazo padrão a partir da gravação; sem data válida, conta de hoje. */
export function prazoPadraoDaCaptura(dataCaptacao: string | null, hoje: Date = new Date()): string {
  return isYmd(dataCaptacao)
    ? prazoEdicaoPadrao(dataCaptacao)
    : addDiasUteis(formatIsoDate(hoje), PRAZO_EDICAO_DIAS_UTEIS);
}
