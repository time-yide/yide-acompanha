import { SEED_SERVICOS, YIDE_NAP, YIDE_PERFIS } from "./config";

const AREA_ATENDIDA = [
  { "@type": "City", name: "Cuiabá" },
  { "@type": "City", name: "Várzea Grande" },
  { "@type": "State", name: "Mato Grosso" },
  { "@type": "Country", name: "Brasil" },
];

const DIAS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function enderecoYide() {
  return { "@type": "PostalAddress", streetAddress: YIDE_NAP.rua, postalCode: YIDE_NAP.cep,
    addressLocality: YIDE_NAP.cidade, addressRegion: YIDE_NAP.uf, addressCountry: YIDE_NAP.pais };
}

export interface JsonLdInput {
  servicoNome: string; descricao: string; url: string;
  localidadeNome: string; tipo: "cidade" | "estado"; uf: string;
  faq: { pergunta: string; resposta: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonLdServicoLocal(i: JsonLdInput): { "@context": string; "@graph": any[] } {
  const areaServed = i.tipo === "cidade"
    ? { "@type": "City", name: i.localidadeNome }
    : { "@type": "AdministrativeArea", name: i.localidadeNome };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: any[] = [
    { "@type": "ProfessionalService", "@id": `${YIDE_NAP.site}/#organizacao`, name: YIDE_NAP.nome, telephone: YIDE_NAP.telefone,
      email: YIDE_NAP.email, url: YIDE_NAP.site, address: enderecoYide() },
    { "@type": "Service", name: `${i.servicoNome} em ${i.localidadeNome}`, description: i.descricao, serviceType: i.servicoNome,
      provider: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site }, areaServed, url: i.url },
  ];
  if (i.faq.length > 0) {
    graph.push({ "@type": "FAQPage", mainEntity: i.faq.map((f) => ({
      "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** Quem é a Yide, com os mesmos dados em todas as páginas: ajuda Google e IAs a reconhecerem a marca. */
export function jsonLdOrganizacao() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${YIDE_NAP.site}/#organizacao`,
    name: YIDE_NAP.nome,
    url: YIDE_NAP.site,
    logo: `${YIDE_NAP.site}/brand/logo-yide.png`,
    image: `${YIDE_NAP.site}/brand/logo-yide.png`,
    telephone: YIDE_NAP.telefone,
    email: YIDE_NAP.email,
    address: enderecoYide(),
    geo: { "@type": "GeoCoordinates", latitude: YIDE_NAP.geo.lat, longitude: YIDE_NAP.geo.lng },
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: DIAS, opens: "00:00", closes: "23:59" },
    areaServed: AREA_ATENDIDA,
    knowsAbout: SEED_SERVICOS.map((s) => s.nome),
    sameAs: YIDE_PERFIS,
  };
}


export interface JsonLdServicoNacionalInput {
  nome: string; descricao: string; url: string;
  faq: { pergunta: string; resposta: string }[];
}

/** Página de serviço nacional: Service + FAQPage + BreadcrumbList, ligados à organização. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonLdServicoNacional(i: JsonLdServicoNacionalInput): { "@context": string; "@graph": any[] } {
  const org = { "@id": `${YIDE_NAP.site}/#organizacao` };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: any[] = [
    { "@type": "Service", name: i.nome, serviceType: i.nome, description: i.descricao, url: i.url, provider: org, areaServed: AREA_ATENDIDA },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${YIDE_NAP.site}/` },
      { "@type": "ListItem", position: 2, name: "Serviços", item: `${YIDE_NAP.site}/servicos` },
      { "@type": "ListItem", position: 3, name: i.nome, item: i.url },
    ] },
  ];
  if (i.faq.length > 0) {
    graph.push({ "@type": "FAQPage", mainEntity: i.faq.map((f) => ({
      "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
