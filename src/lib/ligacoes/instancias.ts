/**
 * Tipos + helpers das instâncias (números/ramais) cadastrados em Ligações.
 */

export const PROVEDORES = [
  "twilio", "ifix", "3cx", "totalvoice", "vonage",
  "evolution", "zapi", "chatpro", "manual", "outro",
] as const;
export type Provedor = (typeof PROVEDORES)[number];

export interface ProvedorDef {
  value: Provedor;
  label: string;
  tipo: "telefone" | "whatsapp" | "ambos";
  /** Verde quando integração está pronta; amarelo "em construção". */
  status: "pronto" | "em_construcao";
  campos: ProvedorCampo[];
  webhookHint?: string;
}

export interface ProvedorCampo {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  obrigatorio: boolean;
  helper?: string;
}

/**
 * Definições dos provedores suportados. Quando integrar de verdade um,
 * muda status: "em_construcao" → "pronto" + implementa o webhook handler
 * em src/app/api/webhooks/ligacoes/[provedor]/route.ts
 */
export const PROVEDOR_DEFS: ProvedorDef[] = [
  {
    value: "ifix",
    label: "iFix",
    tipo: "telefone",
    status: "em_construcao",
    webhookHint: "Cole essa URL no iFix → Configurações → Webhooks → URL de eventos de chamada",
    campos: [
      { key: "url_api", label: "URL da API", type: "url", placeholder: "https://api.ifix.com.br/...", obrigatorio: true },
      { key: "token", label: "Token de API", type: "password", obrigatorio: true },
      { key: "ramal_id", label: "ID do Ramal", type: "text", placeholder: "1001", obrigatorio: true },
    ],
  },
  {
    value: "twilio",
    label: "Twilio (ligar pelo sistema)",
    tipo: "telefone",
    status: "pronto",
    webhookHint:
      "No Twilio: crie um TwiML App e aponte a Voice URL pra rota /api/ligacoes/twilio/voice. As chaves (Account SID, API Key SID/Secret, TwiML App SID) vão nas envs do Vercel.",
    campos: [],
  },
  {
    value: "3cx",
    label: "3CX",
    tipo: "telefone",
    status: "em_construcao",
    webhookHint: "Cole essa URL em 3CX → Settings → Webhooks → Outgoing/Incoming Call",
    campos: [
      { key: "url_servidor", label: "URL do servidor 3CX", type: "url", placeholder: "https://meu-3cx.com.br", obrigatorio: true },
      { key: "api_key", label: "API Key", type: "password", obrigatorio: true },
    ],
  },
  {
    value: "totalvoice",
    label: "Zenvia (ex-TotalVoice)",
    tipo: "telefone",
    status: "pronto",
    webhookHint: "Cole essa URL no painel da Zenvia → Desenvolvedores → Webhooks (eventos de chamada)",
    campos: [],
  },
  {
    value: "vonage",
    label: "Vonage (ex-Nexmo)",
    tipo: "telefone",
    status: "em_construcao",
    campos: [
      { key: "api_key", label: "API Key", type: "text", obrigatorio: true },
      { key: "api_secret", label: "API Secret", type: "password", obrigatorio: true },
    ],
  },
  {
    value: "evolution",
    label: "Evolution API",
    tipo: "whatsapp",
    status: "em_construcao",
    webhookHint: "Configure no Evolution → Webhook → URL de eventos",
    campos: [
      { key: "url_base", label: "URL base do Evolution", type: "url", placeholder: "https://meu-evolution.up.railway.app", obrigatorio: true },
      { key: "api_key", label: "API Key", type: "password", obrigatorio: true },
      { key: "instance_id", label: "Instance ID", type: "text", placeholder: "yasmin-wpp", obrigatorio: true },
    ],
  },
  {
    value: "zapi",
    label: "Z-API",
    tipo: "whatsapp",
    status: "em_construcao",
    webhookHint: "Configure no Z-API → Webhooks",
    campos: [
      { key: "instance_id", label: "Instance ID", type: "text", obrigatorio: true },
      { key: "token", label: "Token", type: "password", obrigatorio: true },
      { key: "client_token", label: "Client Token (Security)", type: "password", obrigatorio: false },
    ],
  },
  {
    value: "chatpro",
    label: "ChatPro",
    tipo: "whatsapp",
    status: "em_construcao",
    campos: [
      { key: "instance_id", label: "Instance ID", type: "text", obrigatorio: true },
      { key: "token", label: "Token", type: "password", obrigatorio: true },
    ],
  },
  {
    value: "manual",
    label: "Manual (sem integração)",
    tipo: "ambos",
    status: "pronto",
    campos: [],
  },
  {
    value: "outro",
    label: "Outro provedor",
    tipo: "ambos",
    status: "em_construcao",
    campos: [
      { key: "observacoes", label: "Observações", type: "text", obrigatorio: false, helper: "Nos diga qual provedor pra a gente implementar a integração" },
    ],
  },
];

export const PROVEDOR_BY_VALUE: Record<string, ProvedorDef> = Object.fromEntries(
  PROVEDOR_DEFS.map((p) => [p.value, p]),
);

export const STATUS_INSTANCIA_DEFS: Record<string, { label: string; color: string }> = {
  desconectado: { label: "Desconectado", color: "border-muted-foreground/30 text-muted-foreground" },
  aguardando_qr: { label: "Aguardando QR", color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  conectado: { label: "Conectado", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  erro: { label: "Erro", color: "border-destructive/40 bg-destructive/10 text-destructive" },
};
