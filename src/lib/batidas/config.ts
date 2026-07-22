// src/lib/batidas/config.ts
// Lógica pura da cadência de 14 batidas. Sem I/O — testável isoladamente.

export const BATIDAS_META = 14;

/** Status de leads_gerados que encerram a cadência como sucesso. */
const LEAD_GERADO_SUCESSO = new Set(["reuniao_marcada", "proposta_enviada", "cliente"]);

/** Stages de leads (Onboarding) que indicam que já passou da prospecção (sucesso). */
const LEAD_STAGE_SUCESSO = new Set([
  "reuniao_comercial",
  "proposta_enviada",
  "contrato",
  "marco_zero",
  "ativo",
  "comercial", // legado: equivalente a "já em negociação comercial"
]);

export function leadGeradoEmSucesso(status: string): boolean {
  return LEAD_GERADO_SUCESSO.has(status);
}

export function leadGeradoDescartado(status: string): boolean {
  return status === "descartado";
}

export function leadOnboardingEmSucesso(stage: string, _motivoPerdido: string | null): boolean {
  return LEAD_STAGE_SUCESSO.has(stage);
}

export function leadOnboardingDescartado(motivoPerdido: string | null): boolean {
  return !!motivoPerdido && motivoPerdido.trim().length > 0;
}

/** Papéis que enxergam todos os prospectos; os demais só os que são responsáveis. */
export function roleVeTudo(role: string): boolean {
  return role === "adm" || role === "socio" || role === "coordenador" || role === "comercial";
}
