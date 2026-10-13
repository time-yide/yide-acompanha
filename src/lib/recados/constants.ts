// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const NOTIF_SCOPES = ["todos", "meu_time", "nenhum"] as const;
export const REACAO_EMOJIS = ["👍", "❤️", "✅", "🎉"] as const;

export type NotifScope = (typeof NOTIF_SCOPES)[number];
export type ReacaoEmoji = (typeof REACAO_EMOJIS)[number];
