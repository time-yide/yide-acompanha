// Módulo puro (sem server-only): casa clientes com contas externas pelo nome / @ do Instagram.
import { normalizarNome } from "@/lib/ecommerce/yideecom-match";
import type { CampoConexao, Confianca, Sugestao, SugestoesCliente } from "./tipos";

export interface ClienteConexao {
  id: string;
  nome: string;
  instagram_url: string | null;
  instagram_business_id: string | null;
  facebook_page_id: string | null;
  meta_ad_account_id: string | null;
  ga4_property_id: string | null;
  gsc_site_url: string | null;
  crm_tipo: string | null;
  crm_identifier: string | null;
}

export interface FontesConexao {
  paginas: Array<{ pageId: string; nome: string; igId: string | null; igUsername: string | null }> | null;
  contas: Array<{ id: string; nome: string; empresa: string | null }> | null;
  ga4: Array<{ id: string; nome: string }> | null;
  gsc: string[] | null;
  lyide: Array<{ slug: string; name: string }> | null;
}

const LIMIAR_NOME = 0.75;
const LIMIAR_GOOGLE = 0.85;

const STOPWORDS = new Set([
  "de", "da", "do", "dos", "das", "e", "ca", "conta", "loja", "oficial", "mt", "cuiaba", "vg",
  "ltda", "me", "eireli", "pix", "01", "02", "03", "the", "dr", "dra", "studio",
]);

/** Só null/"" é vazio. Espaço em branco conta como preenchido (nunca sugere: a guarda do UPDATE não casaria). */
const vazio = (v: string | null | undefined) => v == null || v === "";

/** @ do Instagram a partir da URL/handle cadastrado. "https://www.instagram.com/foo_bar/?hl=pt" → "foo_bar". */
export function handleInstagram(url: string | null): string | null {
  if (!url) return null;
  let s = url.trim();
  if (!s) return null;
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  else if (/^https?:\/\//i.test(s)) return null;
  s = s.replace(/^@+/, "").replace(/[/?#].*$/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(s)) return null;
  if (["p", "reel", "reels", "stories", "explore"].includes(s)) return null;
  return s;
}

/** Palavras significativas do nome (sem acento, sem ruído tipo "loja", "cuiabá", "ltda"). */
export function tokens(nome: string): string[] {
  return normalizarNome(nome ?? "")
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Tokens colados + posições de fronteira de palavra (início de cada token e o fim). */
function compactado(ts: string[]): { s: string; inicios: number[]; fronteiras: Set<number> } {
  const inicios: number[] = [];
  let s = "";
  for (const t of ts) { inicios.push(s.length); s += t; }
  return { s, inicios, fronteiras: new Set([...inicios, s.length]) };
}

/**
 * 0..1. Nome normalizado igual = 1; mesmas palavras coladas = 0.95;
 * menor colado dentro do maior (≥5 letras, começando E terminando em fronteira de palavra) = 0.85;
 * todas as palavras do menor (≥2) dentro do maior = 0.8; senão Jaccard das palavras.
 */
export function similaridade(a: string, b: string): number {
  const na = normalizarNome(a ?? "");
  const nb = normalizarNome(b ?? "");
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const ca = compactado(ta);
  const cb = compactado(tb);
  if (ca.s === cb.s) return 0.95;

  const sa = new Set(ta);
  const sb = new Set(tb);
  const inter = [...sa].filter((t) => sb.has(t)).length;
  const uniao = new Set([...sa, ...sb]).size;
  let score = uniao ? inter / uniao : 0;

  const [menor, maior] = ca.s.length <= cb.s.length ? [ca, cb] : [cb, ca];
  if (menor.s.length >= 5 && maior.inicios.some((i) => maior.s.startsWith(menor.s, i) && maior.fronteiras.has(i + menor.s.length))) {
    score = Math.max(score, 0.85);
  }

  const [tMenor, tMaior] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  if (tMenor.size >= 2 && [...tMenor].every((t) => tMaior.has(t))) score = Math.max(score, 0.8);
  return score;
}

const SUFIXOS_DOMINIO = [
  "com.br", "net.br", "org.br", "adv.br", "med.br", "ind.br", "eng.br", "art.br", "blog.br", "app.br", "tur.br",
  "com", "net", "org", "br", "io", "co", "app", "site", "online", "store", "shop", "dev", "me", "info", "biz",
];

/** "https://www.petmarket.com.br/" ou "sc-domain:petmarket.com.br" → "petmarket". */
export function rotuloDominio(site: string): string | null {
  let h = (site ?? "").trim().toLowerCase()
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/[/?#:].*$/, "")
    .replace(/^www\./, "");
  if (!h) return null;
  for (const suf of SUFIXOS_DOMINIO) {
    if (h.endsWith(`.${suf}`)) { h = h.slice(0, -(suf.length + 1)); break; }
  }
  const partes = h.split(".").filter(Boolean);
  const label = (partes.at(-1) ?? "").replace(/-/g, "");
  return label || null;
}

/** Nome do cliente vs rótulo do domínio. 1 = igual; 0.85 = um começa/termina com o outro (≥5 letras). */
function similaridadeDominio(nome: string, label: string): number {
  const cheio = normalizarNome(nome).replace(/ /g, "");
  const semRuido = tokens(nome).join("");
  if (!label) return 0;
  if (label === cheio || label === semRuido) return 1;
  for (const c of [semRuido, cheio]) {
    if (c.length < 5) continue;
    if (label.startsWith(c) || label.endsWith(c)) return 0.85;
    if (label.length >= 5 && (c.startsWith(label) || c.endsWith(label))) return 0.85;
  }
  return 0;
}

/** Normaliza o valor pra comparar "já usado por outro cliente" (act_ e properties/ opcionais). */
export function chaveUso(campo: CampoConexao, valor: string): string {
  let v = valor.trim();
  if (campo === "meta_ad_account_id") v = v.replace(/^act_/, "");
  if (campo === "ga4_property_id") v = v.replace(/^properties\//, "");
  if (campo === "gsc_site_url" || campo === "crm_identifier") v = v.toLowerCase();
  return `${campo}:${v}`;
}

/** Chaves (campo:valor) já gravadas em clientes da organização → id do cliente dono. */
export function idsUsados(clientes: ClienteConexao[]): Map<string, string> {
  const s = new Map<string, string>();
  for (const c of clientes) {
    const pares: Array<[CampoConexao, string | null]> = [
      ["instagram_business_id", c.instagram_business_id],
      ["facebook_page_id", c.facebook_page_id],
      ["meta_ad_account_id", c.meta_ad_account_id],
      ["ga4_property_id", c.ga4_property_id],
      ["gsc_site_url", c.gsc_site_url],
      ["crm_identifier", c.crm_tipo === "yide" ? c.crm_identifier : null],
    ];
    for (const [campo, v] of pares) if (!vazio(v) && !s.has(chaveUso(campo, v as string))) s.set(chaveUso(campo, v as string), c.id);
  }
  return s;
}

/** Sugestão com a pontuação usada pra desempate. */
export interface Candidato extends Sugestao { score: number }

/** Melhor candidato; empate entre valores diferentes no topo = ambíguo → nenhum. */
function melhor(cands: Candidato[]): Candidato | null {
  if (cands.length === 0) return null;
  const top = Math.max(...cands.map((c) => c.score));
  const noTopo = cands.filter((c) => c.score === top);
  if (new Set(noTopo.map((c) => c.valor)).size > 1) return null;
  return noTopo[0];
}

const conf = (score: number): Confianca => (score >= 1 ? "alta" : "media");

/** Candidatos de um cliente, só pros campos VAZIOS. Sem a regra de unicidade entre clientes. */
export function candidatosDoCliente(c: ClienteConexao, f: FontesConexao): Candidato[] {
  const out: Candidato[] = [];
  const nome = c.nome ?? "";

  // Instagram + Facebook (mesma página).
  if (f.paginas && (vazio(c.instagram_business_id) || vazio(c.facebook_page_id))) {
    const handle = handleInstagram(c.instagram_url);
    const pelaIg = f.paginas.filter((p) =>
      (handle && p.igUsername === handle)
      || (!vazio(c.instagram_business_id) && p.igId === c.instagram_business_id)
      || (!vazio(c.facebook_page_id) && p.pageId === c.facebook_page_id));
    const igCands: Candidato[] = [];
    const fbCands: Candidato[] = [];
    if (pelaIg.length > 0) {
      for (const p of pelaIg) {
        const motivo = handle && p.igUsername === handle ? `Mesmo @ do Instagram cadastrado (@${handle})`
          : p.pageId === c.facebook_page_id ? "Página já cadastrada" : "Instagram já cadastrado é desta página";
        if (p.igId) igCands.push({ campo: "instagram_business_id", valor: p.igId, rotulo: `Instagram: @${p.igUsername ?? p.igId}`, confianca: "alta", motivo, score: 1.1 });
        fbCands.push({ campo: "facebook_page_id", valor: p.pageId, rotulo: `Facebook: ${p.nome || p.pageId}`, confianca: "alta", motivo, score: 1.1 });
      }
    } else {
      for (const p of f.paginas) {
        // @ cadastrado diferente do Instagram da página = é outra empresa: nem Facebook nem Instagram.
        if (handle && p.igUsername && p.igUsername !== handle) continue;
        const s = similaridade(nome, p.nome);
        if (s < LIMIAR_NOME) continue;
        const motivo = `Nome parecido com a página “${p.nome}”`;
        fbCands.push({ campo: "facebook_page_id", valor: p.pageId, rotulo: `Facebook: ${p.nome || p.pageId}`, confianca: "media", motivo, score: s });
        if (p.igId) {
          igCands.push({ campo: "instagram_business_id", valor: p.igId, rotulo: `Instagram: @${p.igUsername ?? p.igId}`, confianca: "media", motivo, score: s });
        }
      }
    }
    if (vazio(c.instagram_business_id)) { const m = melhor(igCands); if (m) out.push(m); }
    if (vazio(c.facebook_page_id)) { const m = melhor(fbCands); if (m) out.push(m); }
  }

  // Conta de anúncios.
  if (f.contas && vazio(c.meta_ad_account_id)) {
    const cands: Candidato[] = [];
    for (const a of f.contas) {
      const s = Math.max(similaridade(nome, a.nome), a.empresa ? similaridade(nome, a.empresa) : 0);
      if (s < LIMIAR_NOME) continue;
      const exibe = a.empresa && a.empresa !== a.nome ? `${a.nome} (${a.empresa})` : a.nome;
      cands.push({ campo: "meta_ad_account_id", valor: a.id, rotulo: `Anúncios: ${exibe || a.id}`, confianca: conf(s), motivo: s >= 1 ? "Mesmo nome" : "Nome parecido", score: s });
    }
    const m = melhor(cands); if (m) out.push(m);
  }

  // GA4: nome da conta e da propriedade.
  if (f.ga4 && vazio(c.ga4_property_id)) {
    const cands: Candidato[] = [];
    for (const p of f.ga4) {
      const partes = p.nome.split(" — ").map((x) => x.trim()).filter(Boolean);
      let s = 0;
      for (const parte of partes) {
        s = Math.max(s, similaridade(nome, parte));
        if (/\.[a-z]{2,}/i.test(parte)) s = Math.max(s, similaridadeDominio(nome, rotuloDominio(parte) ?? ""));
      }
      if (s < LIMIAR_GOOGLE) continue;
      cands.push({ campo: "ga4_property_id", valor: p.id, rotulo: `Google Analytics: ${p.nome}`, confianca: conf(s), motivo: s >= 1 ? "Mesmo nome" : "Nome parecido", score: s });
    }
    const m = melhor(cands); if (m) out.push(m);
  }

  // Search Console: rótulo do domínio.
  if (f.gsc && vazio(c.gsc_site_url)) {
    const cands: Candidato[] = [];
    for (const site of f.gsc) {
      const s = similaridadeDominio(nome, rotuloDominio(site) ?? "");
      if (s < LIMIAR_GOOGLE) continue;
      cands.push({ campo: "gsc_site_url", valor: site, rotulo: `Search Console: ${site}`, confianca: conf(s), motivo: s >= 1 ? "Domínio igual ao nome" : "Domínio parecido com o nome", score: s });
    }
    // sc-domain e https:// do mesmo domínio empatam: prefere a propriedade de domínio.
    const top = cands.length ? Math.max(...cands.map((x) => x.score)) : 0;
    const noTopo = cands.filter((x) => x.score === top);
    const rotulos = new Set(noTopo.map((x) => rotuloDominio(x.valor)));
    const m = rotulos.size === 1 ? (noTopo.find((x) => x.valor.startsWith("sc-domain:")) ?? melhor(noTopo)) : null;
    if (m) out.push(m);
  }

  // Lyide: só se não há outro CRM configurado ("nenhum" é o padrão do formulário, conta como livre).
  const crmLivre = (vazio(c.crm_tipo) || c.crm_tipo === "yide" || c.crm_tipo === "nenhum") && vazio(c.crm_identifier);
  if (f.lyide && crmLivre) {
    const cands: Candidato[] = [];
    for (const e of f.lyide) {
      const s = similaridade(nome, e.name);
      if (s < LIMIAR_NOME) continue;
      cands.push({ campo: "crm_identifier", valor: e.slug, rotulo: `Lyide: ${e.name}`, confianca: conf(s), motivo: s >= 1 ? "Mesmo nome" : "Nome parecido", score: s });
    }
    const m = melhor(cands); if (m) out.push(m);
  }
  return out;
}

const semScore = (c: Candidato): Sugestao => ({ campo: c.campo, valor: c.valor, rotulo: c.rotulo, confianca: c.confianca, motivo: c.motivo });

/** Sugestões de UM cliente (sem checar conflito com outros clientes). */
export function sugerirParaCliente(cliente: ClienteConexao, fontes: FontesConexao): Sugestao[] {
  return candidatosDoCliente(cliente, fontes).map(semScore);
}

/**
 * Sugestões pra todos: cada conta externa vai pra UM cliente só (maior pontuação;
 * empate = ninguém) e nunca pra uma conta já gravada em OUTRO cliente (`usados`: chave → dono).
 * Página e Instagram andam juntos: se um dos dois já é de alguém, o par todo é dele.
 */
export function sugerirConexoes(clientes: ClienteConexao[], fontes: FontesConexao, usados: Map<string, string>): SugestoesCliente[] {
  const dono = new Map(usados);
  for (const p of fontes.paginas ?? []) {
    if (!p.igId) continue;
    const kFb = chaveUso("facebook_page_id", p.pageId);
    const kIg = chaveUso("instagram_business_id", p.igId);
    const d = dono.get(kFb) ?? dono.get(kIg);
    if (d) { if (!dono.has(kFb)) dono.set(kFb, d); if (!dono.has(kIg)) dono.set(kIg, d); }
  }
  const livre = (chave: string, clientId: string) => { const d = dono.get(chave); return !d || d === clientId; };

  const porCliente = clientes.map((c) => ({ c, cands: candidatosDoCliente(c, fontes) }));
  const porChave = new Map<string, Array<{ clientId: string; score: number }>>();
  for (const { c, cands } of porCliente) {
    for (const k of cands) {
      const chave = chaveUso(k.campo, k.valor);
      if (!livre(chave, c.id)) continue;
      const l = porChave.get(chave) ?? [];
      l.push({ clientId: c.id, score: k.score });
      porChave.set(chave, l);
    }
  }
  const vencedor = new Map<string, string | null>();
  for (const [chave, l] of porChave) {
    const top = Math.max(...l.map((x) => x.score));
    const noTopo = l.filter((x) => x.score === top);
    vencedor.set(chave, noTopo.length === 1 ? noTopo[0].clientId : null);
  }
  const out: SugestoesCliente[] = [];
  for (const { c, cands } of porCliente) {
    const itens = cands.filter((k) => vencedor.get(chaveUso(k.campo, k.valor)) === c.id).map(semScore);
    if (itens.length) out.push({ clientId: c.id, clienteNome: c.nome, itens });
  }
  return out;
}
