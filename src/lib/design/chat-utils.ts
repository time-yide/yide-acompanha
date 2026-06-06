// Pure (non-server) helpers for the Studio chat.
// Kept separate from chat-actions.ts so they can be imported by
// both "use server" files and plain client code without triggering
// the Next.js "Server Actions must be async" constraint.

export interface ChatMsg { role: "user" | "assistant"; content: string }

/** Monta o array de mensagens da Anthropic a partir do histórico + nova msg. */
export function montarMensagensChat(historico: ChatMsg[], nova: string): ChatMsg[] {
  const limpo = historico.filter((m) => m.role === "user" || m.role === "assistant");
  return [...limpo, { role: "user", content: nova }];
}
