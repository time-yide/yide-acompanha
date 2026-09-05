interface LeadData {
  empresa: string;
  decisor_nome?: string | null;
  categoria?: string | null;
  cidade?: string | null;
}

export function renderTemplate(corpo: string, lead: LeadData): string {
  return corpo
    .replace(/\{empresa\}/g, lead.empresa || "")
    .replace(/\{nome\}/g, lead.decisor_nome || lead.empresa || "")
    .replace(/\{categoria\}/g, lead.categoria || "")
    .replace(/\{cidade\}/g, lead.cidade || "");
}

export function normalizeTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}
