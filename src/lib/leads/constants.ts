// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const STAGES = [
  "leads_potencial",
  "leads_ativos",
  "reuniao_comercial",
  "proposta_enviada",
  "contrato",
  "marco_zero",
  "ativo",
] as const;
export const PRIORITIES = ["alta", "media", "baixa"] as const;
export type Stage = typeof STAGES[number];

/**
 * Quem pode interagir (mover, marcar perdido, arrastar) com um card baseado
 * no estágio atual. Mapa compartilhado entre server (actions) e client
 * (LeadCard) pra UI esconder botões e action bloquear.
 */
export const STAGE_INTERACTORS: Record<Stage, readonly string[]> = {
  leads_potencial: ["adm", "socio", "comercial", "programacao"],
  leads_ativos: ["adm", "socio", "comercial", "programacao"],
  proposta_enviada: ["adm", "socio", "comercial", "programacao"],
  reuniao_comercial: ["adm", "socio", "comercial", "programacao"],
  contrato: ["adm", "socio", "coordenador"],
  marco_zero: ["adm", "socio", "coordenador", "assessor"],
  ativo: ["socio", "coordenador", "assessor"],
};

export function canInteractWithStage(role: string, stage: Stage): boolean {
  return STAGE_INTERACTORS[stage]?.includes(role) ?? false;
}
