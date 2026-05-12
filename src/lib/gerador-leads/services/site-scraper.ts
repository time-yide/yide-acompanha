// SERVER ONLY — scraper leve do site da empresa
//
// Estratégia:
// 1. Acessa a homepage
// 2. Procura links pra páginas internas comuns (sobre, equipe, contato, fundador)
// 3. Acessa essas páginas
// 4. Extrai: emails, telefones, nomes próximos a títulos como "CEO", "Sócio", etc.
//
// Tudo em cima de fetch + cheerio. Sem dependências pesadas.
// Timeout total ~30s por site. Se site tiver Cloudflare/proteção avançada, falha
// graciosamente e volta com o que conseguir.

import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGES_PER_SITE = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; YideLeadsBot/1.0; +https://sistemaacompanha.yidedigital.com.br)";

// Termos que indicam página relevante (sobre, equipe, contato, dono)
const RELEVANT_PATH_KEYWORDS = [
  "sobre", "about", "quem-somos", "quem_somos", "quemsomos",
  "equipe", "time", "team", "nosso-time", "nossa-equipe",
  "contato", "contact", "fale-conosco", "fale_conosco",
  "diretoria", "diretores", "fundador", "fundadores", "founder",
];

// Cargos que indicam decisor — ordem importa (do mais alto pra mais baixo)
export const CARGOS_DECISOR = [
  "ceo", "presidente", "fundador", "fundadora", "founder", "co-founder", "cofundador",
  "sócio", "socio", "sócia", "socia", "owner", "proprietário", "proprietaria",
  "diretor", "diretora", "director",
  "gerente comercial", "head de marketing", "marketing manager",
  "gerente", "manager",
];

export interface SiteScrapingResult {
  /** URL final usada (após redirects). */
  finalUrl: string | null;
  /** True se pelo menos a homepage retornou OK. */
  success: boolean;
  error: string | null;
  /** Páginas visitadas (debug). */
  pagesVisited: string[];
  /** Emails únicos encontrados em qualquer página. */
  emails: string[];
  /** Telefones únicos encontrados (BR-format prioritário). */
  telefones: string[];
  /** Pessoas detectadas: nome + cargo (heurística). */
  pessoas: PersonHit[];
  /** Texto do "sobre" (primeiros 2000 chars), passado pra IA depois. */
  textoSobre: string | null;
}

export interface PersonHit {
  nome: string;
  cargo: string | null;
  /** De qual página veio (relativa ou absoluta). */
  source: string;
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

/**
 * Normaliza URL: garante https://, remove trailing slash, etc.
 */
function normalizeUrl(input: string): string | null {
  if (!input) return null;
  let url = input.trim();
  if (!url) return null;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Busca links na homepage que apontam pra páginas relevantes (sobre, equipe, etc).
 */
function findRelevantLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const lowerHref = href.toLowerCase();
    const isRelevant = RELEVANT_PATH_KEYWORDS.some((kw) => lowerHref.includes(kw));
    if (!isRelevant) return;
    try {
      const absolute = new URL(href, baseUrl).toString();
      // Só URLs no mesmo domínio
      if (new URL(absolute).origin === new URL(baseUrl).origin) {
        found.add(absolute.split("#")[0]);
      }
    } catch {
      // ignora href inválido
    }
  });
  return [...found].slice(0, MAX_PAGES_PER_SITE - 1); // -1 pq homepage já conta
}

/**
 * Extrai emails de um texto. Filtra emails óbvios de banco de imagem/sistema.
 */
function extractEmails(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex) ?? [];
  const filtered = matches
    .map((e) => e.toLowerCase())
    .filter((e) => !e.includes("example.com"))
    .filter((e) => !e.includes("@sentry"))
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".gif"))
    .filter((e) => !e.includes("noreply") && !e.includes("no-reply"));
  return [...new Set(filtered)];
}

/**
 * Extrai telefones brasileiros do texto. Pega formatos comuns:
 * (65) 99999-9999 | 65 99999-9999 | +55 65 99999-9999 | 5565999999999
 */
function extractTelefones(text: string): string[] {
  const regex = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/g;
  const matches = text.match(regex) ?? [];
  const cleaned = matches
    .map((p) => p.replace(/[^\d+]/g, ""))
    .filter((p) => p.length >= 10 && p.length <= 14);
  return [...new Set(cleaned)];
}

/**
 * Heurística pra detectar pessoas (nome + cargo) no HTML.
 * Procura padrões como:
 *   <h3>João Silva</h3><p>CEO</p>
 *   <strong>Maria Santos - Sócia</strong>
 *   "fundador", "CEO", "diretor" próximo a um nome próprio
 */
function extractPessoas($: cheerio.CheerioAPI, sourceUrl: string): PersonHit[] {
  const hits: PersonHit[] = [];
  const seen = new Set<string>();

  // 1) Procura cargo conhecido + nome próprio próximo
  const text = $("body").text();
  const sentences = text.split(/[\.\n\r]+/).map((s) => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    if (sentence.length > 200) continue; // muito longo, provavelmente lixo
    const lower = sentence.toLowerCase();
    for (const cargo of CARGOS_DECISOR) {
      const idx = lower.indexOf(cargo);
      if (idx === -1) continue;
      // Tenta extrair nome próprio na vizinhança
      // Padrão A: "Cargo: Nome Sobrenome" ou "Cargo - Nome Sobrenome"
      const after = sentence.slice(idx + cargo.length).trim();
      const nameMatchAfter = after.match(/^[\s:,\-—|]*((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\s){1,3}[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/);
      // Padrão B: "Nome Sobrenome, Cargo"
      const before = sentence.slice(0, idx).trim();
      const nameMatchBefore = before.match(/((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\s){1,3}[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)[\s:,\-—|]*$/);

      const nome = (nameMatchAfter?.[1] ?? nameMatchBefore?.[1] ?? "").trim();
      if (!nome || nome.length < 5) continue;
      const key = `${nome.toLowerCase()}:${cargo}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ nome, cargo, source: sourceUrl });
      if (hits.length >= 10) return hits;
    }
  }

  return hits;
}

/**
 * Extrai texto da seção "sobre" — prioriza <main>, <article>, divs com classe sobre.
 * Retorna primeiros 2000 chars.
 */
function extractTextoSobre($: cheerio.CheerioAPI): string | null {
  const candidates = [
    $("[class*=sobre]").first().text(),
    $("[class*=about]").first().text(),
    $("article").first().text(),
    $("main").first().text(),
    $("body").text(),
  ];
  for (const c of candidates) {
    const cleaned = c.replace(/\s+/g, " ").trim();
    if (cleaned.length > 50) return cleaned.slice(0, 2000);
  }
  return null;
}

/**
 * Faz scraping completo do site da empresa.
 * Sempre retorna um objeto — nunca throw. Erros vão em result.error.
 */
export async function scrapeSiteEmpresa(websiteRaw: string | null | undefined): Promise<SiteScrapingResult> {
  const result: SiteScrapingResult = {
    finalUrl: null,
    success: false,
    error: null,
    pagesVisited: [],
    emails: [],
    telefones: [],
    pessoas: [],
    textoSobre: null,
  };

  const url = normalizeUrl(websiteRaw ?? "");
  if (!url) {
    result.error = "URL inválida ou ausente";
    return result;
  }

  let homepageHtml: string;
  let homeFinalUrl: string;
  try {
    const resp = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!resp.ok) {
      result.error = `HTTP ${resp.status} na homepage`;
      return result;
    }
    homeFinalUrl = resp.url;
    result.finalUrl = homeFinalUrl;
    homepageHtml = await resp.text();
    result.pagesVisited.push(homeFinalUrl);
    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }

  const collectedEmails = new Set<string>();
  const collectedTelefones = new Set<string>();
  const allPessoas: PersonHit[] = [];

  function processHtml(html: string, sourceUrl: string) {
    const $ = cheerio.load(html);
    extractEmails($("body").text() + " " + html).forEach((e) => collectedEmails.add(e));
    extractTelefones($("body").text()).forEach((t) => collectedTelefones.add(t));
    allPessoas.push(...extractPessoas($, sourceUrl));
    if (!result.textoSobre) {
      const sobre = extractTextoSobre($);
      if (sobre) result.textoSobre = sobre;
    }
  }

  processHtml(homepageHtml, homeFinalUrl);

  // Encontra páginas relevantes
  const $home = cheerio.load(homepageHtml);
  const relevantLinks = findRelevantLinks($home, homeFinalUrl);

  // Visita cada uma
  for (const link of relevantLinks) {
    try {
      const resp = await fetchWithTimeout(link, FETCH_TIMEOUT_MS);
      if (!resp.ok) continue;
      const html = await resp.text();
      result.pagesVisited.push(link);
      processHtml(html, link);
    } catch {
      // ignora — continua tentando outras
    }
  }

  // Dedupa pessoas (por nome) — prioriza cargos mais altos
  const pessoasMap = new Map<string, PersonHit>();
  for (const p of allPessoas) {
    const key = p.nome.toLowerCase();
    const existing = pessoasMap.get(key);
    if (!existing) {
      pessoasMap.set(key, p);
      continue;
    }
    // Já existe: substitui se o cargo novo é mais alto (índice menor em CARGOS_DECISOR)
    if (p.cargo && existing.cargo) {
      const idxNew = CARGOS_DECISOR.indexOf(p.cargo);
      const idxOld = CARGOS_DECISOR.indexOf(existing.cargo);
      if (idxNew >= 0 && (idxOld < 0 || idxNew < idxOld)) {
        pessoasMap.set(key, p);
      }
    }
  }
  result.pessoas = [...pessoasMap.values()].slice(0, 10);
  result.emails = [...collectedEmails].slice(0, 20);
  result.telefones = [...collectedTelefones].slice(0, 10);

  return result;
}
