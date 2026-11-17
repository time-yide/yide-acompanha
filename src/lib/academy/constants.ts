// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const QUESTOES_POR_CURSO = 10;
export const NOTA_MINIMA = 7;
export const PONTOS_POR_CURSO = 100;
