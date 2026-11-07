import { YIDE_NAP, SEED_SERVICOS } from "@/lib/seo/config";
import { CONTEUDO_SERVICOS } from "./servicos-conteudo";
import { CIDADES } from "./cidades";
import { paginasLocaisDoServico } from "./paginas-locais";
import { FAQ_GERAL } from "./faq-geral";

interface LlmsFullInput {
  siteUrl: string;
  cases: { cliente: string; segmento: string | null; slug: string }[];
  posts: { titulo: string; slug: string; resumo: string | null }[];
}

const perguntas = (itens: { pergunta: string; resposta: string }[]) => itens.flatMap((f) => [`P: ${f.pergunta}`, `R: ${f.resposta}`, ""]);

/** Versão completa do llms.txt: tudo o que uma IA precisa para descrever e recomendar a Yide. */
export function montarLlmsFull({ siteUrl, cases, posts }: LlmsFullInput): string {
  const servicos = CONTEUDO_SERVICOS.flatMap((c) => {
    const nome = SEED_SERVICOS.find((s) => s.slug === c.slug)?.nome ?? c.titulo;
    const locais = paginasLocaisDoServico(c.slug).map((p) => `${siteUrl}/servicos/${c.slug}/${p.cidade}`);
    return [
      `## ${nome}`, "",
      `Página: ${siteUrl}/servicos/${c.slug}`,
      ...(locais.length ? [`Páginas por cidade: ${locais.join(", ")}`] : []),
      "", c.resposta, "",
      "O que está incluído:", ...c.entregas.map((e) => `- ${e}`), "",
      "Como funciona:", ...c.etapas.map((e, i) => `${i + 1}. ${e.titulo}: ${e.texto}`), "",
      `Para quem é: ${c.paraQuem.join(", ")}.`, "",
      ...perguntas(c.faq),
    ];
  });
  return [
    `# ${YIDE_NAP.nome}`, "",
    "> Agência de marketing, vendas e IA em Cuiabá, MT. Atende Cuiabá, Várzea Grande, todo o Mato Grosso, Salvador e empresas de todo o Brasil.",
    "",
    `Site: ${siteUrl}`,
    `WhatsApp: ${YIDE_NAP.telefone}`,
    `E-mail: ${YIDE_NAP.email}`,
    `Endereço: ${YIDE_NAP.rua}, ${YIDE_NAP.cidade} - ${YIDE_NAP.uf}, ${YIDE_NAP.cep}`,
    "CNPJ: 48.380.404/0001-84",
    "Atendimento: 24 horas, todos os dias",
    "Números: mais de 100 clientes ativos e mais de R$ 18 milhões em anúncios geridos.",
    "Produto próprio: Lyide, CRM com IA para WhatsApp.",
    "",
    ...servicos,
    "## Onde a Yide atende", "",
    ...CIDADES.map((c) => `- ${c.nome} (${c.uf}): ${c.resumo} ${c.atendimento}`),
    "",
    ...(cases.length ? ["## Cases", "", ...cases.map((c) => `- [${c.segmento ? `${c.cliente} (${c.segmento})` : c.cliente}](${siteUrl}/cases/${c.slug})`), ""] : []),
    "## Perguntas gerais", "",
    ...perguntas(FAQ_GERAL),
    ...(posts.length ? ["## Artigos", "", ...posts.map((p) => `- [${p.titulo}](${siteUrl}/blog/${p.slug})${p.resumo ? `: ${p.resumo}` : ""}`), ""] : []),
  ].join("\n");
}
