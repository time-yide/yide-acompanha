// Regras da "edição urgente" (vídeo que precisa sair antes do prazo padrão
// de 3 dias úteis). Usado no agendamento da gravação (calendário) e na subida
// da captação. Client-safe.
import { isYmd, prazoEdicaoPadrao } from "@/lib/datas/dias-uteis";

export interface EdicaoUrgente {
  /** null = não respondido (só eventos antigos). */
  urgente: boolean | null;
  data: string | null;
  qtd: number | null;
}

/** Lê os campos `edicao_urgente` ("sim"/"nao"), `edicao_urgente_data`, `edicao_urgente_qtd`. */
export function parseEdicaoUrgente(formData: FormData): EdicaoUrgente {
  const raw = String(formData.get("edicao_urgente") ?? "");
  const urgente = raw === "sim" ? true : raw === "nao" ? false : null;
  if (!urgente) return { urgente, data: null, qtd: null };
  const data = String(formData.get("edicao_urgente_data") ?? "").trim() || null;
  const qtdRaw = Number(formData.get("edicao_urgente_qtd"));
  const qtd = Number.isFinite(qtdRaw) && qtdRaw > 0 ? Math.floor(qtdRaw) : null;
  return { urgente, data, qtd };
}

/**
 * Valida a resposta. Retorna a mensagem de erro, ou null se estiver ok.
 * `qtdVideos` só existe na captação (no agendamento ainda não se sabe).
 */
export function validarEdicaoUrgente(
  v: EdicaoUrgente,
  dataGravacao: string,
  qtdVideos?: number,
): string | null {
  if (v.urgente === null) {
    return "Responda se tem edição que precisa sair antes do prazo (Sim ou Não)";
  }
  if (!v.urgente) return null;
  if (!isYmd(v.data)) return "Informe a data em que a edição urgente precisa sair";
  if (!v.qtd || v.qtd < 1) return "Informe quantos vídeos são urgentes";
  if (isYmd(dataGravacao)) {
    if (v.data < dataGravacao) return "A data urgente não pode ser antes da gravação";
    const prazo = prazoEdicaoPadrao(dataGravacao);
    if (v.data >= prazo) {
      return `Essa data já está dentro do prazo normal (${formatYmdBr(prazo)}). Marque "Não".`;
    }
  }
  if (qtdVideos !== undefined && v.qtd > qtdVideos) {
    return "Vídeos urgentes não podem ser mais que o total de vídeos da captação";
  }
  return null;
}

/** Colunas pra gravar no banco (zera data/qtd quando não é urgente). */
export function edicaoUrgenteColunas(v: EdicaoUrgente) {
  return {
    edicao_urgente: v.urgente,
    edicao_urgente_data: v.urgente ? v.data : null,
    edicao_urgente_qtd: v.urgente ? v.qtd : null,
  };
}

export const EDICAO_URGENTE_COLUNAS = [
  "edicao_urgente",
  "edicao_urgente_data",
  "edicao_urgente_qtd",
] as const;

/** Erro do Supabase indica que a migration das colunas ainda não foi aplicada. */
export function isErroColunaEdicaoUrgente(msg: unknown): boolean {
  const s = String(msg ?? "");
  return s.includes("edicao_urgente") || s.includes("task_urgente_id");
}

export function semColunasEdicaoUrgente<T extends Record<string, unknown>>(payload: T): T {
  const copy = { ...payload } as Record<string, unknown>;
  for (const c of EDICAO_URGENTE_COLUNAS) delete copy[c];
  return copy as T;
}

export function formatYmdBr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
