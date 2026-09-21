import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { getAnthropicClient } from "@/lib/ai/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const MODEL = "claude-haiku-4-5-20251001";

const DATAS_COMEMORATIVAS: Record<number, string[]> = {
  1: [
    "Confraternização Universal (01/01)",
    "Dia do Comerciário (pós-Natal)",
  ],
  2: ["Carnaval", "Dia de São Valentim (14/02)"],
  3: [
    "Dia Internacional da Mulher (08/03)",
    "Dia do Consumidor (15/03)",
    "Início do Outono (20/03)",
  ],
  4: ["Páscoa", "Dia do Índio (19/04)", "Tiradentes (21/04)"],
  5: [
    "Dia do Trabalhador (01/05)",
    "Dia das Mães (2º domingo)",
    "Dia do Profissional de Marketing (08/05)",
  ],
  6: [
    "Dia dos Namorados (12/06)",
    "Festa Junina",
    "Início do Inverno (21/06)",
  ],
  7: [
    "Dia do Amigo (20/07)",
    "Dia do Escritor (25/07)",
    "Férias escolares",
  ],
  8: [
    "Dia dos Pais (2º domingo)",
    "Dia do Estagiário (18/08)",
    "Dia da Fotografia (19/08)",
  ],
  9: [
    "Independência do Brasil (07/09)",
    "Início da Primavera (22/09)",
    "Dia do Cliente (15/09)",
  ],
  10: [
    "Dia das Crianças (12/10)",
    "Dia do Professor (15/10)",
    "Halloween (31/10)",
    "Dia do Comerciário (2ª feira após 15/10)",
  ],
  11: [
    "Black Friday (última sexta)",
    "Dia da Consciência Negra (20/11)",
    "Cyber Monday",
  ],
  12: [
    "Natal (25/12)",
    "Réveillon (31/12)",
    "Início do Verão (21/12)",
    "Confraternizações de fim de ano",
  ],
};

export async function sendPlanejamentoMensalWpp(): Promise<{
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
  const mesProximo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nomeMes = mesProximo.toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "America/Cuiaba",
  });
  const mesSeguinteNum = mesProximo.getMonth() + 1;
  const datas = DATAS_COMEMORATIVAS[mesSeguinteNum] ?? [];

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
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `Gere UMA mensagem para o grupo de WhatsApp do cliente "${client.nome}" (serviço: ${servico}).

Contexto: estamos no dia 21 e precisamos planejar o conteúdo de ${nomeMes}.

Datas comemorativas de ${nomeMes}: ${datas.join(", ")}

A mensagem deve:
- Perguntar se tem algo especial planejado pro mês que vem (promoção, lançamento, evento)
- Mencionar 2-3 datas comemorativas que façam sentido pro negócio do cliente (nem todas fazem sentido pra todos)
- Pedir ideias ou temas que o cliente quer abordar
- Tom conversacional, como se fosse um colega perguntando no grupo
- Máximo 4-5 frases
- Sem parecer IA, sem excesso de emojis (1-2 no máximo)
- NÃO assine, NÃO coloque "Equipe Yide" nem nome
- NÃO use formatação markdown, negrito ou itálico
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
      console.error(`[planejamento-wpp] Erro cliente ${client.nome}:`, err);
      skipped++;
    }
  }

  return { sent, skipped };
}
