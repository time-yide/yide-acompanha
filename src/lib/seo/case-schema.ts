import { YIDE_NAP } from "./config";
export interface JsonLdCaseInput {
  titulo: string; descricao: string; url: string;
  depoimentoTexto: string; depoimentoAutor: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonLdCase(i: JsonLdCaseInput): { "@context": string; "@graph": any[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: any[] = [
    { "@type": "Article", headline: i.titulo, description: i.descricao, url: i.url,
      author: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site },
      publisher: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site } },
  ];
  if (i.depoimentoTexto.trim()) {
    graph.push({ "@type": "Review", reviewBody: i.depoimentoTexto,
      author: { "@type": "Person", name: i.depoimentoAutor || "Cliente" },
      itemReviewed: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site } });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
