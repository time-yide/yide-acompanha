// Organiza o blog público pelos problemas do dono de empresa. Artigo estratégico
// (sem fonte_url) é sempre do empresário; notícia só entra se tocar num desses
// assuntos, senão vai para "Notícias do mercado" no fim da página.

export interface TemaEmpresario {
  slug: string;
  nome: string;
  termos: RegExp;
}

export const TEMAS_EMPRESARIO: TemaEmpresario[] = [
  { slug: "atrair-clientes", nome: "Atrair clientes", termos: /an[uú]nci|tr[aá]fego|google ads|meta ads|instagram ads|impulsion|remarketing|campanha|verba|investir em/i },
  { slug: "vender-no-whatsapp", nome: "Vender no WhatsApp", termos: /whatsapp|follow.?up|atendimento|lead|vendedor|vendas|venda|desconto|pre[cç]o|script|funil|indica[cç]/i },
  { slug: "ia-e-crm", nome: "IA e CRM", termos: /\bia\b|intelig[eê]ncia artificial|crm|chatgpt|automa/i },
  { slug: "aparecer-no-google", nome: "Aparecer no Google", termos: /google maps|perfil da empresa|avalia[cç]|\bsite\b|landing|seo|aparecer|google meu neg/i },
  { slug: "ecommerce-e-delivery", nome: "E-commerce e delivery", termos: /e-?commerce|mercado livre|shopee|marketplace|loja virtual|tiktok shop|ifood|delivery|restaurante|hamburgueria/i },
  { slug: "gestao-e-numeros", nome: "Gestão e números", termos: /gest[aã]o|processo|meta de|planejamento|cac|lucro|finan|precific|contratar|equipe|operacional|indicador/i },
  { slug: "escolher-agencia", nome: "Escolher agência", termos: /ag[eê]ncia|gestor de tr[aá]fego|freelancer|social media|contrato/i },
];

interface PostBasico {
  titulo: string;
  resumo: string | null;
  keywords: string[];
  fonte_url: string | null;
}

function texto(p: PostBasico): string {
  return `${p.titulo} ${p.resumo ?? ""} ${p.keywords.join(" ")}`;
}

/** Temas do empresário que o post toca (pode ser mais de um). */
export function temasDoPost(p: PostBasico): string[] {
  const t = texto(p);
  return TEMAS_EMPRESARIO.filter((x) => x.termos.test(t)).map((x) => x.slug);
}

/** Notícia de plataforma que não muda nada pro dono de PME (ex.: Twitch, app de edição). */
const SO_PARA_PROFISSIONAL = /twitch|edits app|\bapp edits\b|adobe|canva|figma|cannes|le[aã]o|pr[eê]mio|award|ag[eê]ncia [a-z]+ conquista|rebranding de/i;

/** O post interessa ao dono de empresa? Estratégico sempre; notícia só se tocar num tema do empresário. */
export function ehParaEmpresario(p: PostBasico): boolean {
  if (!p.fonte_url) return true;
  if (SO_PARA_PROFISSIONAL.test(p.titulo)) return false;
  return temasDoPost(p).length > 0;
}

/** Separa os posts: os do empresário (filtrados pelo tema, se houver) e as notícias de mercado. */
export function separarPosts<T extends PostBasico>(posts: T[], tema?: string | null): { doEmpresario: T[]; mercado: T[] } {
  const doEmpresario: T[] = [];
  const mercado: T[] = [];
  for (const p of posts) (ehParaEmpresario(p) ? doEmpresario : mercado).push(p);
  const valido = tema && TEMAS_EMPRESARIO.some((t) => t.slug === tema) ? tema : null;
  return {
    doEmpresario: valido ? doEmpresario.filter((p) => temasDoPost(p).includes(valido)) : doEmpresario,
    mercado,
  };
}
