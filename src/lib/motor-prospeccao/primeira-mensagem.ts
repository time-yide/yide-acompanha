// Primeira mensagem do motor: bate-papo casual, sem pitch.
// Mensagem de "oi" gera muito mais resposta que pitch de vendas no WhatsApp;
// a IA conversacional se apresenta quando a pessoa responde.

export const SAUDACOES_CASUAIS = [
  "Oi, tudo bem? 😊",
  "Oii, tudo bem?",
  "Oi! Tudo bem com você? 😊",
  "E aí, tudo bem? 😊",
  "Oii! Tudo bom?",
] as const;

/** É o primeiro WhatsApp da sequência (sem conversa anterior)? */
export function ehPrimeiraMensagem(templateTipo: string, aiTentativas: number): boolean {
  if (templateTipo === "primeiro_contato") return true;
  return templateTipo === "auto" && aiTentativas === 0;
}

/**
 * Escolhe uma saudação casual de forma determinística a partir de uma semente
 * (ex: id do lead), pra variar entre leads sem repetir sempre a mesma.
 */
export function montarPrimeiraMensagemCasual(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return SAUDACOES_CASUAIS[hash % SAUDACOES_CASUAIS.length];
}

const B2B_KEYWORDS = [
  "indústria", "industria", "industrial", "fábrica", "fabrica", "fabricante",
  "distribuidora", "distribuidor", "atacadista", "importadora", "exportadora",
  "metalúrgica", "metalurgica", "agroindústria", "agroindustria", "logística",
  "logistica", "transportadora", "b2b",
] as const;

/** Perfil do lead pra IA adaptar a linguagem: B2B (indústria) ou B2C (comércio/serviço local). */
export function perfilPublico(categoria: string | null | undefined): "b2b" | "b2c" {
  if (!categoria) return "b2c";
  const lower = categoria.toLowerCase();
  return B2B_KEYWORDS.some((kw) => lower.includes(kw)) ? "b2b" : "b2c";
}
