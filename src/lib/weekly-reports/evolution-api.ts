import "server-only";

interface SendMessageResult {
  success: boolean;
  error?: string;
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<SendMessageResult> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instance) {
    console.warn("Evolution API not configured, skipping WhatsApp");
    return { success: false, error: "Evolution API not configured" };
  }

  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: `${number}@s.whatsapp.net`,
        text: message,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Evolution API error:", res.status, body);
      return { success: false, error: `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Evolution API error:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatWeeklyReportMessage(
  clientNome: string,
  semanaInicio: string,
  semanaFim: string,
  data: {
    posts_publicados: number;
    metricas: Record<string, { valor: number; variacao_pct: number }>;
  },
  portalLink: string
): string {
  const inicio = new Date(semanaInicio + "T12:00:00").toLocaleDateString("pt-BR");
  const fim = new Date(semanaFim + "T12:00:00").toLocaleDateString("pt-BR");

  const seta = (v: number) => (v >= 0 ? `+${v}%` : `${v}%`);
  const m = data.metricas;

  return [
    `📊 *Relatório Semanal — ${clientNome}*`,
    `📅 ${inicio} a ${fim}`,
    "",
    `✅ ${data.posts_publicados} posts publicados`,
    m.alcance ? `👁 Alcance: ${m.alcance.valor.toLocaleString("pt-BR")} (${seta(m.alcance.variacao_pct)})` : null,
    m.curtidas ? `❤️ Curtidas: ${m.curtidas.valor.toLocaleString("pt-BR")} (${seta(m.curtidas.variacao_pct)})` : null,
    m.comentarios ? `💬 Comentários: ${m.comentarios.valor.toLocaleString("pt-BR")} (${seta(m.comentarios.variacao_pct)})` : null,
    m.salvamentos ? `📌 Salvamentos: ${m.salvamentos.valor.toLocaleString("pt-BR")} (${seta(m.salvamentos.variacao_pct)})` : null,
    "",
    `🔗 Veja completo: ${portalLink}`,
  ].filter(Boolean).join("\n");
}
