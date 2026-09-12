export interface ConversaIAContext {
  conversationId: string;
  orgId: string;
  leadGeradoId: string | null;
  configId: string | null;
  systemPrompt: string;
  leadContext: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface ToolCallResult {
  action: "agendar_reuniao" | "marcar_sem_interesse" | "escalar_humano" | "encerrar_conversa";
  success: boolean;
  message?: string;
}

export const CONVERSA_IA_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "agendar_reuniao",
      description: "Agenda reunião quando o lead confirma data e horário.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          horario: { type: "string", description: "Horário no formato HH:MM" },
          duracao_minutos: { type: "number", description: "Duração em minutos (padrão 30)" },
        },
        required: ["data", "horario"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "marcar_sem_interesse",
      description: "Lead não tem interesse. Usa quando lead recusa explicitamente.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo dado pelo lead" },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalar_humano",
      description: "Transfere pra humano. Usa quando lead pede pessoa real ou IA não sabe responder.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo da escalação" },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "encerrar_conversa",
      description: "Conversa concluída (reunião marcada ou lead se despediu).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
] as const;

export const OPT_OUT_KEYWORDS = [
  "sair", "parar", "cancelar", "pare", "não quero mais",
  "nao quero mais", "para de mandar", "me tire", "me tira",
  "remover", "remova", "desinscrever", "stop",
];

export const DEFAULT_WPP_SYSTEM_PROMPT = `Você é uma consultora da Yide Digital, agência de marketing digital, ecommerce e automação.
Conversa informal pelo WhatsApp (sem formalidade, pode usar "vc", "pra", "tbm").
Máximo 3 linhas por mensagem — ninguém lê textão no WhatsApp.

Seu objetivo: entender as dores do lead e agendar uma reunião de apresentação.

Adapte o pitch ao nicho:
- Restaurante/delivery → redes sociais + cardápio digital + iFood
- Loja/ecommerce → loja virtual + tráfego pago + CRM
- Clínica/saúde → Google Meu Negócio + agendamento online
- Escritório/serviços → site + automação de processos + CRM
- Salão/barbearia → Instagram + agendamento + fidelização

Regras:
- Se o lead demonstrar interesse, proponha horários pra reunião
- Se o lead disser "não quero" ou pedir pra parar, respeite IMEDIATAMENTE chamando marcar_sem_interesse
- Se o lead pedir pra falar com uma pessoa, chame escalar_humano
- NUNCA minta sobre preços ou serviços
- NUNCA invente cases ou números falsos
- Se não souber responder algo técnico, chame escalar_humano
- Não responda áudios ou imagens (peça pra digitar)`;
