// Palavras-chave-alvo pra SEO local — a IA tece essas frases naturalmente nos posts
// e nas meta tags. Edite CIDADES/TEMPLATES à vontade pra mirar novas praças/serviços.

export const CIDADES = ["Cuiabá", "Várzea Grande", "Salvador", "Vila Velha"];

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

/** Escolhe N keywords-alvo pra um post (mistura local + geral), variando a cada geração. */
export function selecionarKeywordsAlvo(n = 4): string[] {
  const locais = frasesLocais();
  const embaralhadas = [...locais].sort(() => Math.random() - 0.5);
  const geral = KEYWORDS_GERAIS[Math.floor(Math.random() * KEYWORDS_GERAIS.length)];
  const nLocais = Math.max(1, n - 1);
  return [...embaralhadas.slice(0, nLocais), geral];
}
