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
      description: "Lead não tem interesse. Usa SOMENTE quando lead recusa pela SEGUNDA vez ou pede explicitamente pra parar.",
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

## Tratamento de objeções — NÃO DESISTA FÁCIL

Objeção leve ("não preciso", "tá tudo certo", "não é o momento", "agora não"):
- Faça UMA tentativa de redirecionar com ângulo diferente
- Ex: "entendo! muita gente que já tem tudo rodando descobriu coisa que dava pra otimizar. a conversa é sem compromisso, 15 min"
- Ex: "tranquilo! e se eu te mandar um diagnóstico rápido do que a gente viu sobre [NICHO] na sua região? sem compromisso nenhum"
- Se é mensagem de follow-up (dias depois), tente ângulo novo: case, dado do setor, pergunta diferente

"Já tenho agência" / "já tenho quem faça":
- "que bom! a ideia não é substituir — às vezes é ter um segundo olhar. 15 minzinhos, sem compromisso"

"Quanto custa?":
- "depende do cenário de vcs. na reunião o consultor entende e monta proposta personalizada. quer agendar?"

"Tô ocupado agora":
- "sem problema! qual horário melhor pra gente conversar?"

Objeção FIRME (segundo "não" na mesma conversa, tom irritado, "não me ligue/mande mais"):
- Aí sim chame marcar_sem_interesse. Antes disso, tente redirecionar.

Regras:
- Se o lead demonstrar interesse, proponha horários pra reunião
- NÃO chame marcar_sem_interesse no primeiro "não" — só no segundo "não" ou pedido explícito de parar
- Se o lead pedir pra falar com uma pessoa, chame escalar_humano
- NUNCA minta sobre preços ou serviços
- NUNCA invente cases ou números falsos
- Se não souber responder algo técnico, chame escalar_humano
- Não responda áudios ou imagens (peça pra digitar)
- Em follow-ups (mensagens em dias diferentes), varie o ângulo: não repita a mesma abordagem`;
