import { YIDE_NAP } from "./config";

interface LlmsInput {
  siteUrl: string;
  servicos: { nome: string; slug: string; descricao_base: string }[];
  posts: { titulo: string; slug: string; resumo: string | null }[];
}

/** Resumo em texto da empresa para as IAs (llms.txt). Só dados confirmados, sem números de resultado. */
export function montarLlmsTxt({ siteUrl, servicos, posts }: LlmsInput): string {
  const linha = (titulo: string, url: string, descricao?: string | null) =>
    `- [${titulo}](${url})${descricao ? `: ${descricao}` : ""}`;
  return [
    `# ${YIDE_NAP.nome}`,
    "",
    `> Assessoria de marketing, vendas e tecnologia em ${YIDE_NAP.cidade}, ${YIDE_NAP.uf}, Brasil.`,
    "",
    `Site: ${YIDE_NAP.site}`,
    `WhatsApp: ${YIDE_NAP.telefone}`,
    `E-mail: ${YIDE_NAP.email}`,
    "",
    "## Serviços",
    "",
    ...servicos.map((s) => linha(s.nome, `${siteUrl}/servicos/${s.slug}`, s.descricao_base)),
    "",
    "## Artigos",
    "",
    ...posts.map((p) => linha(p.titulo, `${siteUrl}/blog/${p.slug}`, p.resumo)),
    "",
  ].join("\n");
}
