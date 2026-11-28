// Palavras-chave-alvo pra SEO local — a IA tece essas frases naturalmente nos posts
// e nas meta tags. Edite CIDADES/TEMPLATES à vontade pra mirar novas praças/serviços.

/** Praças com equipe presencial da Yide: aparecem na maior parte das keywords. */
export const CIDADES = ["Cuiabá", "Várzea Grande", "Salvador", "Vitória", "Vila Velha"];

/** Outras cidades do Brasil, atendidas online: entram de vez em quando para ampliar o alcance. */
export const CIDADES_BRASIL = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasília", "Goiânia", "Campo Grande",
  "Curitiba", "Porto Alegre", "Recife", "Fortaleza", "Florianópolis", "Rondonópolis", "Sinop",
];

// {cidade} é substituído pelas CIDADES. Marketing + programação (serviços da Yide).
export const TEMPLATES_LOCAIS = [
  "melhor marketing de {cidade}",
  "melhor agência de marketing de {cidade}",
  "gestor de tráfego em {cidade}",
  "agência de tráfego pago em {cidade}",
  "programador em {cidade}",
  "programação e sistemas em {cidade}",
  "desenvolvimento de CRM em {cidade}",
  "criação de site em {cidade}",
];

// Keywords gerais (sem cidade) — reforço temático.
export const KEYWORDS_GERAIS = [
  "marketing digital",
  "gestão de tráfego",
  "CRM",
  "automação de marketing",
  "inteligência artificial no marketing",
  "criação de sistemas",
];

/** Todas as frases locais ("serviço em/de Cidade"). */
export function frasesLocais(): string[] {
  const out: string[] = [];
  for (const c of CIDADES) {
    for (const t of TEMPLATES_LOCAIS) out.push(t.replace("{cidade}", c));
  }
  return out;
}

/**
 * Escolhe N keywords-alvo pra um post (mistura local + geral), variando a cada geração.
 * As frases locais vêm das praças com equipe presencial; com `aleatorio() < 0.3`, uma
 * delas troca por uma cidade de fora (atendida online).
 */
export function selecionarKeywordsAlvo(n = 4, aleatorio: () => number = Math.random): string[] {
  const locais = frasesLocais();
  const embaralhadas = [...locais].sort(() => aleatorio() - 0.5);
  const geral = KEYWORDS_GERAIS[Math.floor(aleatorio() * KEYWORDS_GERAIS.length)];
  const nLocais = Math.max(1, n - 1);
  const escolhidas = embaralhadas.slice(0, nLocais);
  if (nLocais > 1 && aleatorio() < 0.3) {
    const cidade = CIDADES_BRASIL[Math.floor(aleatorio() * CIDADES_BRASIL.length)];
    const tpl = TEMPLATES_LOCAIS[Math.floor(aleatorio() * TEMPLATES_LOCAIS.length)];
    escolhidas[escolhidas.length - 1] = tpl.replace("{cidade}", cidade);
  }
  return [...escolhidas, geral];
}

/** Praças com equipe presencial, para o contexto local do artigo (rodízio). */
export const PRACAS = [
  { nome: "Cuiabá e Várzea Grande (MT)", contexto: "agro, comércio e serviços, calor e período de chuvas, distância dos grandes centros, cidades do interior de Mato Grosso" },
  { nome: "Salvador (BA)", contexto: "turismo, comércio de bairro, serviços, alta temporada e eventos como o Carnaval, Região Metropolitana" },
  { nome: "Vitória e Vila Velha (ES)", contexto: "porto e logística, comércio, serviços, Grande Vitória com cidades muito próximas" },
] as const;

// Nomes que, citados no tema, fixam a praça (índice em PRACAS).
const PRACA_POR_NOME: [RegExp, number][] = [
  [/cuiab[aá]|v[aá]rzea grande|mato grosso/i, 0],
  [/salvador|bahia/i, 1],
  [/vit[oó]ria|vila velha|esp[ií]rito santo/i, 2],
];

/**
 * PURA. Escolhe a praça do artigo. Se o tema cita uma das cidades, usa a praça
 * dela (um artigo "em Cuiabá" não pode sair com contexto de Salvador); senão,
 * as três com equipe presencial em rodízio.
 */
export function escolherPraca(aleatorio: () => number = Math.random, tema = "") {
  const fixa = PRACA_POR_NOME.find(([re]) => re.test(tema));
  if (fixa) return PRACAS[fixa[1]];
  return PRACAS[Math.floor(aleatorio() * PRACAS.length) % PRACAS.length];
}
