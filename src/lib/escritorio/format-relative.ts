import { APP_TIMEZONE, formatTimeBR, getDatePartsInAppTz } from "@/lib/datetime/timezone";

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

  const dParts = getDatePartsInAppTz(d);
  const nowParts = getDatePartsInAppTz(now);

  const sameDay =
    dParts.year === nowParts.year &&
    dParts.month === nowParts.month &&
    dParts.day === nowParts.day;
  if (sameDay) {
    return formatTimeBR(d);
  }

  // "Ontem" no fuso da app - calcula via Date.UTC + 1 dia atrás.
  const yesterdayUtcMs = Date.UTC(
    parseInt(nowParts.year, 10),
    parseInt(nowParts.month, 10) - 1,
    parseInt(nowParts.day, 10) - 1,
    12,
    0,
    0,
  );
  const yesterdayParts = getDatePartsInAppTz(new Date(yesterdayUtcMs));
  const isYesterday =
    dParts.year === yesterdayParts.year &&
    dParts.month === yesterdayParts.month &&
    dParts.day === yesterdayParts.day;
  if (isYesterday) return "ontem";

  if (dParts.year === nowParts.year) {
    return d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "2-digit" });
}
