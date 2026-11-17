// Contexto real de cada praça atendida, usado nas páginas serviço × cidade. Só fatos
// verificáveis (população do Censo 2022, regiões, economia) e como a Yide atende ali.

export interface Cidade {
  slug: string;
  nome: string;
  tipo: "cidade" | "estado";
  uf: string;
  /** Frase curta de apresentação da praça. */
  resumo: string;
  populacao: string;
  regioes: string[];
  segmentos: string[];
  atendimento: string;
}

export const CIDADES: Cidade[] = [
  {
    slug: "cuiaba",
    nome: "Cuiabá",
    tipo: "cidade",
    uf: "MT",
    resumo: "Capital de Mato Grosso e sede da Yide, no Jardim das Américas.",
    populacao: "cerca de 650 mil habitantes (Censo 2022)",
    regioes: ["Centro", "Jardim das Américas", "Goiabeiras", "Duque de Caxias", "Bosque da Saúde", "Santa Rosa", "Jardim Itália", "CPA", "Coxipó", "Despraiado"],
    segmentos: ["Comércio de rua e shopping", "Restaurantes e delivery", "Clínicas e consultórios", "Escolas e cursos", "Prestadores de serviço", "Imobiliárias e construtoras"],
    atendimento: "Reuniões presenciais na sede da Yide, no Jardim das Américas, ou na sua empresa, e gravações no local.",
  },
  {
    slug: "varzea-grande",
    nome: "Várzea Grande",
    tipo: "cidade",
    uf: "MT",
    resumo: "Segunda maior cidade de Mato Grosso, colada a Cuiabá do outro lado do rio, onde fica o Aeroporto Internacional Marechal Rondon.",
    populacao: "cerca de 300 mil habitantes (Censo 2022)",
    regioes: ["Centro", "Cristo Rei", "Jardim Glória", "Mapim", "Água Limpa", "Ponte Nova", "Avenida da FEB", "Avenida Couto Magalhães"],
    segmentos: ["Comércio de bairro", "Distribuidoras e atacado", "Indústria e logística", "Oficinas e autopeças", "Clínicas e saúde", "Alimentação"],
    atendimento: "A equipe da Yide atravessa a ponte: reuniões e gravações presenciais em Várzea Grande, além do acompanhamento online.",
  },
  {
    slug: "salvador",
    nome: "Salvador",
    tipo: "cidade",
    uf: "BA",
    resumo: "Capital da Bahia e uma das praças atendidas pela Yide fora de Mato Grosso.",
    populacao: "cerca de 2,4 milhões de habitantes (Censo 2022)",
    regioes: ["Pituba", "Itaigara", "Caminho das Árvores", "Barra", "Rio Vermelho", "Graça", "Imbuí", "Stiep", "Paralela", "Comércio"],
    segmentos: ["Turismo e hotelaria", "Bares e restaurantes", "Clínicas e saúde", "Varejo", "Prestadores de serviço", "Educação"],
    atendimento: "Atendimento online com reuniões por vídeo e acompanhamento 24 horas pelo sistema da Yide; gravações locais combinadas no diagnóstico.",
  },
  {
    slug: "mato-grosso",
    nome: "Mato Grosso",
    tipo: "estado",
    uf: "MT",
    resumo: "Estado com economia puxada pelo agronegócio e cidades médias que crescem rápido no interior.",
    populacao: "cerca de 3,66 milhões de habitantes (Censo 2022)",
    regioes: ["Rondonópolis", "Sinop", "Sorriso", "Lucas do Rio Verde", "Tangará da Serra", "Primavera do Leste", "Barra do Garças", "Cáceres"],
    segmentos: ["Revendas agrícolas e de máquinas", "Cooperativas e agroindústria", "Varejo regional", "Concessionárias", "Saúde e clínicas", "Educação"],
    atendimento: "Atendimento online com reuniões por vídeo e visitas programadas no interior para gravação e planejamento.",
  },
];

export function cidadePorSlug(slug: string): Cidade | null {
  return CIDADES.find((c) => c.slug === slug) ?? null;
}
