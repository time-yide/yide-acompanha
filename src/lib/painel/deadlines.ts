export type StepKey =
  | "cronograma"
  | "design"
  | "tpg"
  | "tpm"
  | "valor_trafego"
  | "gmn_post"
  | "camera"
  | "mobile"
  | "edicao"
  | "reuniao"
  | "postagem";

export type StepStatus = "pendente" | "em_andamento" | "pronto" | "atrasada";

/**
 * Prazos D-X (dia do mês) por etapa.
 * Calculados relativos ao primeiro dia do mês corrente.
 * Hardcoded — pode tornar configurável por cliente em fase futura.
 */
export const STEP_DEADLINES: Record<StepKey, number> = {
  cronograma: 7,
  tpg: 12,
  tpm: 12,
  valor_trafego: 12,
  design: 23,
  camera: 23,
  mobile: 23,
  edicao: 23,
  gmn_post: 26,
  reuniao: 26,
  postagem: 30,
};

export function getDeadline(stepKey: StepKey): number {
  return STEP_DEADLINES[stepKey];
}

export function isAtrasada(stepKey: StepKey, status: StepStatus, today: Date = new Date()): boolean {
  if (status === "pronto") return false;
  const dia = today.getUTCDate();
  return dia > STEP_DEADLINES[stepKey];
}
