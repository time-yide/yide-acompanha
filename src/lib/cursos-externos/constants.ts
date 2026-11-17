// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

/**
 * Lista canônica de plataformas pra mostrar como sugestão. Campo é texto
 * livre no banco - usuário pode digitar uma plataforma fora dessa lista.
 */
export const PLATAFORMAS_SUGERIDAS = [
  "Hotmart",
  "Eduzz",
  "Kiwify",
  "Udemy",
  "Alura",
  "Coursera",
  "Membro Plus",
  "Youtube Premium",
  "Outro",
] as const;
