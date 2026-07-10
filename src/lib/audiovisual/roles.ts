// Constants compartilhadas entre server actions e server components.
// Fica num arquivo separado de actions.ts porque "use server" só permite
// exports de funções async (limitação do Next.js 16).

/**
 * Roles que podem ser delegados pra editar uma captação. Inclui editores
 * (papel principal), videomakers (que também editam o próprio material em
 * alguns fluxos) e coordenador audiovisual (que pode pegar edição quando
 * a equipe tá apertada).
 */
export const ROLES_QUE_EDITAM: Array<"editor" | "videomaker" | "fast_midia" | "audiovisual_chefe"> = [
  "editor",
  "videomaker",
  "fast_midia",
  "audiovisual_chefe",
];
