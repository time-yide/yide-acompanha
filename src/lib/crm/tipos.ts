/**
 * CRMs suportados como rótulo no cadastro de clientes.
 *
 * `yide` é o CRM próprio (meu-novo-sistema, multi-tenant). Quando estiver
 * deployado, vai ter env var `NEXT_PUBLIC_YIDE_CRM_URL` com a base URL e
 * `crm_identifier` vai ser o tenant_id/slug do cliente lá. Aí o "Abrir CRM"
 * monta `${YIDE_CRM_URL}/${identifier}` (deep link com sessão da equipe Yide).
 */

export type CrmTipo =
  | "yide"
  | "rd_station"
  | "hubspot"
  | "pipedrive"
  | "ploomes"
  | "kommo"
  | "agendor"
  | "salesforce"
  | "zoho"
  | "bitrix"
  | "custom"
  | "planilha"
  | "nenhum";

export interface CrmDef {
  value: CrmTipo;
  label: string;
  /** Cor do badge (Tailwind classes). */
  color: string;
  /** URL placeholder pra ajudar usuário a saber o que colar. */
  urlPlaceholder?: string;
  /** Identifier placeholder. */
  identifierPlaceholder?: string;
  /** Quando true, é o CRM Yide - tem botão especial "Abrir como agência". */
  isYide?: boolean;
}

export const CRM_DEFS: CrmDef[] = [
  {
    value: "yide",
    label: "CRM Yide",
    color: "border-primary/40 bg-primary/10 text-primary",
    urlPlaceholder: "Detectado automaticamente",
    identifierPlaceholder: "tenant_id ou slug do cliente no CRM Yide",
    isYide: true,
  },
  {
    value: "rd_station",
    label: "RD Station CRM",
    color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    urlPlaceholder: "https://app.rdstation.com.br/...",
  },
  {
    value: "hubspot",
    label: "HubSpot",
    color: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    urlPlaceholder: "https://app.hubspot.com/contacts/...",
  },
  {
    value: "pipedrive",
    label: "Pipedrive",
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    urlPlaceholder: "https://[empresa].pipedrive.com",
  },
  {
    value: "ploomes",
    label: "Ploomes",
    color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    urlPlaceholder: "https://app2.ploomes.com",
  },
  {
    value: "kommo",
    label: "Kommo (ex-amoCRM)",
    color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    urlPlaceholder: "https://[empresa].kommo.com",
  },
  {
    value: "agendor",
    label: "Agendor",
    color: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    urlPlaceholder: "https://app.agendor.com.br/...",
  },
  {
    value: "salesforce",
    label: "Salesforce",
    color: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    urlPlaceholder: "https://[empresa].my.salesforce.com",
  },
  {
    value: "zoho",
    label: "Zoho CRM",
    color: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    urlPlaceholder: "https://crm.zoho.com",
  },
  {
    value: "bitrix",
    label: "Bitrix24",
    color: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    urlPlaceholder: "https://[empresa].bitrix24.com.br",
  },
  {
    value: "custom",
    label: "Outro CRM",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    urlPlaceholder: "https://...",
  },
  {
    value: "planilha",
    label: "Planilha (sem CRM)",
    color: "border-muted-foreground/30 text-muted-foreground",
  },
  {
    value: "nenhum",
    label: "Nenhum",
    color: "border-muted-foreground/30 text-muted-foreground",
  },
];

export const CRM_BY_VALUE: Record<string, CrmDef> = Object.fromEntries(
  CRM_DEFS.map((c) => [c.value, c]),
);

/** Retorna URL final pra abrir o CRM do cliente (deep link). */
export function buildCrmOpenUrl(
  tipo: string | null | undefined,
  url: string | null | undefined,
  identifier: string | null | undefined,
): string | null {
  if (!tipo || tipo === "nenhum" || tipo === "planilha") return null;

  if (tipo === "yide") {
    // Quando o CRM Yide estiver deployado, usar env var
    const base = process.env.NEXT_PUBLIC_YIDE_CRM_URL;
    if (!base) return null;
    if (identifier) return `${base.replace(/\/$/, "")}/agencia/empresas/${identifier}`;
    return base;
  }

  // Demais CRMs: usa a URL livre que o usuário colou
  if (url && url.trim()) return url.trim();
  return null;
}
