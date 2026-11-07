import { YIDE_NAP } from "./config";

interface LlmsInput {
  siteUrl: string;
  servicos: { nome: string; slug: string; descricao_base: string }[];
  posts: { titulo: string; slug: string; resumo: string | null }[];
  cases?: { cliente: string; segmento: string | null; slug: string }[];
}

/** Resumo em texto da empresa para as IAs (llms.txt). Só dados confirmados, sem números de resultado. */
export function montarLlmsTxt({ siteUrl, servicos, posts, cases = [] }: LlmsInput): string {
  const linha = (titulo: string, url: string, descricao?: string | null) =>
    `- [${titulo}](${url})${descricao ? `: ${descricao}` : ""}`;
  return [
    `# ${YIDE_NAP.nome}`,
    "",
    `> Agência de marketing, vendas e IA em ${YIDE_NAP.cidade}, ${YIDE_NAP.uf}. Atende Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil.`,
    "",
    `Site: ${YIDE_NAP.site}`,
    `WhatsApp: ${YIDE_NAP.telefone}`,
    `E-mail: ${YIDE_NAP.email}`,
    `Endereço: ${YIDE_NAP.rua}, ${YIDE_NAP.cidade} - ${YIDE_NAP.uf}, ${YIDE_NAP.cep}`,
    "Atendimento: 24 horas, todos os dias",
    "Atende: Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil",
    "",
    "## Serviços",
    "",
    ...servicos.map((s) => linha(s.nome, `${siteUrl}/servicos/${s.slug}`, s.descricao_base)),
    "",
    ...(cases.length
      ? ["## Cases", "", ...cases.map((c) => linha(c.segmento ? `${c.cliente} (${c.segmento})` : c.cliente, `${siteUrl}/cases/${c.slug}`)), ""]
      : []),
    "## Artigos",
    "",
    ...posts.map((p) => linha(p.titulo, `${siteUrl}/blog/${p.slug}`, p.resumo)),
    "",
  ].join("\n");
}
