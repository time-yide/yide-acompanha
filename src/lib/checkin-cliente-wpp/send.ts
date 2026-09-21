import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { getAnthropicClient } from "@/lib/ai/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const MODEL = "claude-haiku-4-5-20251001";

export async function sendCheckinClienteWpp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, servico_contratado, grupo_wpp_jid")
    .eq("status", "ativo")
    .not("grupo_wpp_jid", "is", null);

  if (!clients || clients.length === 0) return { sent: 0, skipped: 0 };

  interface ClientRow {
    id: string;
    nome: string;
    servico_contratado: string | null;
    grupo_wpp_jid: string;
  }

  const now = new Date();
  const diaSemana = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "America/Cuiaba",
  });

  const anthropic = getAnthropicClient();
  if (!anthropic) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const client of clients as ClientRow[]) {
    if (!client.grupo_wpp_jid?.trim()) {
      skipped++;
      continue;
    }

    try {
      const servico = client.servico_contratado ?? "marketing digital";

      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Gere UMA mensagem curta e casual de check-in para enviar no grupo de WhatsApp do cliente "${client.nome}" (serviço: ${servico}).

Regras:
- Máximo 2-3 frases
- Tom amigável e descontraído, como se fosse um colega
- Pergunte como estão as coisas (vendas, movimento, novidades, etc.)
- Varie o estilo: às vezes use "Oi pessoal!", às vezes "E aí galera!", às vezes "Bom dia equipe!"
- Hoje é ${diaSemana} — pode mencionar o dia da semana naturalmente
- Use 1-2 emojis no máximo
- NÃO assine, NÃO coloque "Equipe Yide" nem nome
- NÃO use formatação markdown
- Responda APENAS com a mensagem, nada mais`,
          },
        ],
      });

      const mensagem =
        resp.content[0].type === "text" ? resp.content[0].text.trim() : null;
      if (!mensagem) {
        skipped++;
        continue;
      }

      const result = await sendWhatsAppGroupMessage(
        client.grupo_wpp_jid,
        mensagem,
        { mentionsEveryOne: true },
      );

      if (result.success) {
        sent++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[checkin-wpp] Erro cliente ${client.nome}:`, err);
      skipped++;
    }
  }

  return { sent, skipped };
}
