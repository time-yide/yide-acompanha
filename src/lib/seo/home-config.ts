export interface Stat { valor: string; rotulo: string }
export interface HomeConfig {
  hero_titulo: string; hero_sub: string; stats: Stat[];
  sobre_titulo: string; sobre_texto: string; cta_titulo: string; clientes: string[];
}
export const HOME_DEFAULTS: HomeConfig = {
  hero_titulo: "Agência de marketing, vendas e IA em Cuiabá",
  hero_sub: "Mais clientes chamando no seu WhatsApp, todo mês. Anúncios, conteúdo, site e o Lyide, CRM com IA, para empresas de Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil.",
  stats: [
    { valor: "+100", rotulo: "clientes ativos" },
    { valor: "+R$ 18 mi", rotulo: "em anúncios geridos" },
    { valor: "24h", rotulo: "de atendimento" },
    { valor: "5+", rotulo: "anos de estrada" },
  ],
  sobre_titulo: "A Yide Digital",
  sobre_texto: "Somos uma agência de marketing, vendas e IA em Cuiabá. Cuidamos do caminho inteiro: do anúncio ao atendimento no WhatsApp, com o Lyide, nosso CRM com inteligência artificial.",
  cta_titulo: "Vamos crescer sua empresa?",
  clientes: [],
};

function isStat(v: unknown): v is Stat {
  return !!v && typeof v === "object" && typeof (v as Stat).valor === "string" && typeof (v as Stat).rotulo === "string";
}
export function mergeHomeConfig(row: Record<string, unknown> | null): HomeConfig {
  const r = row ?? {};
  const str = (k: keyof HomeConfig) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string) : (HOME_DEFAULTS[k] as string));
  const stats = Array.isArray(r.stats) ? (r.stats as unknown[]).filter(isStat) : HOME_DEFAULTS.stats;
  const clientes = Array.isArray(r.clientes) ? (r.clientes as unknown[]).filter((c): c is string => typeof c === "string" && c.trim() !== "") : HOME_DEFAULTS.clientes;
  return {
    hero_titulo: str("hero_titulo"), hero_sub: str("hero_sub"),
    stats: stats.length ? stats : HOME_DEFAULTS.stats,
    sobre_titulo: str("sobre_titulo"), sobre_texto: str("sobre_texto"),
    cta_titulo: str("cta_titulo"), clientes,
  };
}
