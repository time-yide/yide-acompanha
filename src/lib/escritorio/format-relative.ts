/**
 * Formata uma data ISO em estilo "lista de chats do WhatsApp":
 * - <1 min: "agora"
 * - mesmo dia: "10:30"
 * - ontem: "ontem"
 * - mais antigo: "12/05" (ou "12/05/24" se ano diferente)
 */
export function formatRelativeChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = diffMs / 60_000;
  if (diffMin < 1) return "agora";

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "ontem";

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
