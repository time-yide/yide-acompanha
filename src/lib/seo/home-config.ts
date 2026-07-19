export interface Stat { valor: string; rotulo: string }
export interface HomeConfig {
  hero_titulo: string; hero_sub: string; stats: Stat[];
  sobre_titulo: string; sobre_texto: string; cta_titulo: string; clientes: string[];
}
export const HOME_DEFAULTS: HomeConfig = {
  hero_titulo: "Marketing e tecnologia que fazem sua empresa crescer",
  hero_sub: "Tráfego, sites, redes sociais e IA para negócios de Cuiabá, Salvador, Vila Velha e todo o Brasil.",
  stats: [
    { valor: "+100", rotulo: "clientes atendidos" },
    { valor: "4", rotulo: "praças no Brasil" },
    { valor: "5+", rotulo: "anos de estrada" },
    { valor: "24/7", rotulo: "acompanhamento" },
  ],
  sobre_titulo: "A Yide Digital",
  sobre_texto: "Somos uma agência de marketing e programação em Cuiabá que une performance, dados e tecnologia para gerar resultado de verdade.",
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
