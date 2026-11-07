// Contato do site público. Os botões passam pelo link do CRM (Lyide), que registra a
// origem do lead; mensagens montadas (ex.: diagnóstico) vão direto ao WhatsApp com a
// marcação [#yide-geral], que o CRM usa para atribuir a conversa ao site.
export const WHATSAPP_NUMERO = "5565993063452";
export const WHATSAPP_SITE = "https://www.lyide.com.br/c/yide-geral";
const MARCACAO = "[#yide-geral]";

export function whatsappComTexto(texto: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(`${texto}\n${MARCACAO}`)}`;
}

export function ehLinkWhatsApp(href: string | null | undefined): boolean {
  if (!href) return false;
  return href.startsWith("https://www.lyide.com.br/c/") || href.startsWith("https://wa.me/") || href.startsWith("https://api.whatsapp.com/");
}
