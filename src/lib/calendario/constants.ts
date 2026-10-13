// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const SUB_CALENDARS = [
  "agencia",
  "onboarding",
  "aniversarios",
  "videomakers",
  "assessores",
  "coordenadores",
  "programacao",
  "comercial",
] as const;
export type SubCalendar = typeof SUB_CALENDARS[number];

// Sub-calendars que o usuário pode escolher ao criar um evento manual.
// 'aniversarios' é gerado automaticamente a partir de profiles/clients, então
// ficou de fora pra evitar duplicação.
export const SELECTABLE_SUBS = [
  "agencia",
  "videomakers",
  "assessores",
  "coordenadores",
  "programacao",
  "comercial",
] as const;
export type SelectableSub = typeof SELECTABLE_SUBS[number];

// Papéis autorizados a criar evento de videomaker (quem agenda a gravação).
// audiovisual_chefe (Coordenador audiovisual) inclui-se aqui: ele delega o
// videomaker e é obrigado a escolher um, então precisa poder criar o tipo.
export const ROLES_PODEM_CRIAR_VIDEOMAKER = ["socio", "adm", "coordenador", "assessor", "audiovisual_chefe"] as const;

/**
 * Fonte única (client form + server action) de quem pode criar/editar evento
 * do tipo "Videomaker (gravação)". Evita drift entre a UI e a validação.
 */
export function podeCriarVideomaker(role: string): boolean {
  return (ROLES_PODEM_CRIAR_VIDEOMAKER as readonly string[]).includes(role);
}
