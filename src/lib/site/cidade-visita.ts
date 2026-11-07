// Cidade de quem chega por anúncio, para personalizar título e chamada da página.
// O Google manda o código do local no clique ({loc_physical_ms} e {loc_interest_ms}
// no sufixo da URL, como ?loc= e ?loci=). Só cidades conhecidas: texto livre nunca vai
// para a página. Não cria páginas novas: o endereço canônico é sempre o mesmo.

export const ESTADO_MT_LOC = "20096";

/** Códigos de local do Google (geo target) das cidades de MT, com o nome acentuado. */
const CIDADES_POR_LOC: Record<string, string> = {
  "1001602": "Cuiabá", "9199000": "Cuiabá",
  "1032135": "Várzea Grande",
  "1001605": "Rondonópolis",
  "1001606": "Sinop",
  "1032042": "Sorriso",
  "9047766": "Lucas do Rio Verde",
  "1031950": "Primavera do Leste",
  "1001607": "Tangará da Serra",
  "9047779": "Nova Mutum",
  "9224444": "Campo Verde",
  "1031473": "Barra do Garças", "9207399": "Barra do Garças",
  "1001567": "Cáceres",
  "1001600": "Alta Floresta", "9207970": "Alta Floresta",
  "1031933": "Pontes e Lacerda",
  "9047696": "Água Boa", "9232296": "Água Boa",
  "9047718": "Campo Novo do Parecis", "9255305": "Campo Novo do Parecis",
  "9047720": "Canarana", "9254506": "Canarana",
  "9047734": "Colíder",
  "9047764": "Juína",
  "9047801": "Querência",
  "9224953": "Juara",
  "9230748": "Jaciara",
  "9241204": "Chapada dos Guimarães",
  "9244600": "Sapezal",
  "9253593": "Barra do Bugres",
  "9255408": "Confresa",
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const POR_NOME = new Map(Object.values(CIDADES_POR_LOC).map((n) => [normalizar(n), n]));

export function cidadeDaVisita(params: URLSearchParams): string | null {
  for (const chave of ["loc", "loci"]) {
    const v = params.get(chave);
    if (v && CIDADES_POR_LOC[v]) return CIDADES_POR_LOC[v];
  }
  const nome = params.get("cidade");
  return nome ? POR_NOME.get(normalizar(nome)) ?? null : null;
}
